import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from rest_framework import permissions as drf_permissions
from api.models import User
from core.models import Organisation, OrganisationMember, Project, PlaytestFeedback, WorkspaceState, Role
from api.views import PlaytestFeedbackViewSet
import json

factory = APIRequestFactory()

def resp_json(r):
    r.render()
    return json.loads(r.content)

owner, _ = User.objects.get_or_create(username='__ptf3_owner', defaults={'email': 'o3@t.com'})
outsider, _ = User.objects.get_or_create(username='__ptf3_outsider', defaults={'email': 'x3@t.com'})
pinner, _ = User.objects.get_or_create(username='__ptf3_pinner', defaults={'email': 'p3@t.com'})

org, created = Organisation.objects.get_or_create(slug='__test-org-ptf3', defaults={'name': 'Test Org PTF3'})
if created:
    OrganisationMember.objects.create(organisation=org, user=owner, role='owner')
    from api.permission_catalog import create_default_roles
    create_default_roles(org)

project, created = Project.objects.get_or_create(title='__test-project-ptf3', owner=owner, organisation=org, defaults={'description': 'x'})
if created:
    from api.permission_catalog import create_default_project_roles
    create_default_project_roles(project)

# pinner: custom role with ONLY feedback.pin (no other feedback perms)
pin_role, _ = Role.objects.get_or_create(organisation=org, project=project, name='PinnerOnly', defaults={'permissions': ['feedback.pin']})
from core.models import ProjectMember
ProjectMember.objects.filter(project=project, user=pinner).delete()
ProjectMember.objects.create(project=project, user=pinner, role='participant', custom_role=pin_role, status='active')

create_view = PlaytestFeedbackViewSet.as_view({'post': 'create'})
list_view = PlaytestFeedbackViewSet.as_view({'get': 'list'})
pin_view = PlaytestFeedbackViewSet.as_view({'post': 'toggle_pin'}, permission_classes=[drf_permissions.IsAuthenticated])
status_view = PlaytestFeedbackViewSet.as_view({'post': 'set_status'}, permission_classes=[drf_permissions.IsAuthenticated])
convert_view = PlaytestFeedbackViewSet.as_view({'post': 'convert_to_task'}, permission_classes=[drf_permissions.IsAuthenticated])
revert_view = PlaytestFeedbackViewSet.as_view({'post': 'revert_task'}, permission_classes=[drf_permissions.IsAuthenticated])
destroy_view = PlaytestFeedbackViewSet.as_view({'delete': 'destroy'})

print("=== TEST 1: create with priority=urgent ===")
req = factory.post('/api/playtest-feedback/', {'project': project.id, 'title': 'Crash', 'type': 'crash', 'priority': 'urgent', 'description': 'Crashes always.'})
force_authenticate(req, user=outsider)
r = create_view(req)
data = resp_json(r)
print(r.status_code, data.get('priority'))
assert r.status_code == 201
assert data['priority'] == 'urgent'
fb_id = data['id']

print("=== TEST 2: old value 'critical' rejected (renamed to urgent) ===")
req = factory.post('/api/playtest-feedback/', {'project': project.id, 'type': 'bug', 'priority': 'critical', 'description': 'x'})
force_authenticate(req, user=outsider)
r = create_view(req)
print(r.status_code, resp_json(r))
assert r.status_code == 400

print("=== TEST 3: pinner (only feedback.pin) CAN pin but CANNOT set-status ===")
req = factory.post(f'/api/playtest-feedback/{fb_id}/toggle-pin/')
force_authenticate(req, user=pinner)
r = pin_view(req, pk=fb_id)
print('pin:', r.status_code, resp_json(r).get('is_pinned'))
assert r.status_code == 200
assert resp_json(r)['is_pinned'] is True

req = factory.post(f'/api/playtest-feedback/{fb_id}/set-status/', {'status': 'in_progress'}, content_type='application/json')
force_authenticate(req, user=pinner)
r = status_view(req, pk=fb_id)
print('set-status (should 403):', r.status_code)
assert r.status_code == 403

print("=== TEST 4: owner (all perms) CAN set-status and convert-to-task ===")
req = factory.post(f'/api/playtest-feedback/{fb_id}/set-status/', {'status': 'in_progress'}, content_type='application/json')
force_authenticate(req, user=owner)
r = status_view(req, pk=fb_id)
print('set-status:', r.status_code, resp_json(r).get('status'))
assert r.status_code == 200

key = f"workspace__org_{org.id}_board_project_{project.id}"
WorkspaceState.objects.filter(key=key).delete()

req = factory.post(f'/api/playtest-feedback/{fb_id}/convert-to-task/')
force_authenticate(req, user=owner)
r = convert_view(req, pk=fb_id)
data = resp_json(r)
print('convert:', r.status_code, data.get('converted_task_id'))
assert r.status_code == 200
task_id = data['converted_task_id']

ws = WorkspaceState.objects.get(key=key)
tasks = ws.data.get('tasks', [])
columns = ws.data.get('columns', [])
task = next(t for t in tasks if t['id'] == task_id)
print('task title:', task['title'], '| priority:', task['priority'], '| columnId:', task['columnId'], '| first col id:', columns[0]['id'])
assert task['title'].startswith('[Feedback]')
assert task['priority'] == 'urgent'
assert task['columnId'] == columns[0]['id']

print("=== TEST 5: WIP limit blocks conversion when first column is full ===")
fb2 = PlaytestFeedback.objects.create(project=project, author=outsider, type='bug', priority='low', description='second', submitted_at=task['createdAt'])
# Set a WIP limit of 1 on the first column, and it already has 1 task (from TEST 4) -> should block.
ws.data['columns'][0]['wipLimit'] = 1
ws.save(update_fields=['data'])
req = factory.post(f'/api/playtest-feedback/{fb2.id}/convert-to-task/')
force_authenticate(req, user=owner)
r = convert_view(req, pk=fb2.id)
print(r.status_code, resp_json(r))
assert r.status_code == 400
assert 'full' in resp_json(r)['error']

# Raise the limit and retry -> should succeed now.
ws.refresh_from_db()
ws.data['columns'][0]['wipLimit'] = 5
ws.save(update_fields=['data'])
req = factory.post(f'/api/playtest-feedback/{fb2.id}/convert-to-task/')
force_authenticate(req, user=owner)
r = convert_view(req, pk=fb2.id)
print('after raising limit:', r.status_code)
assert r.status_code == 200

print("=== TEST 6: revert-task removes the Kanban task and clears the link ===")
req = factory.post(f'/api/playtest-feedback/{fb_id}/revert-task/')
force_authenticate(req, user=owner)
r = revert_view(req, pk=fb_id)
data = resp_json(r)
print('revert:', r.status_code, 'converted_task_id:', repr(data.get('converted_task_id')))
assert r.status_code == 200
assert data['converted_task_id'] == ''
ws.refresh_from_db()
assert not any(t['id'] == task_id for t in ws.data.get('tasks', []))

print("=== TEST 7: converting again after revert works (not blocked by 'already converted') ===")
req = factory.post(f'/api/playtest-feedback/{fb_id}/convert-to-task/')
force_authenticate(req, user=owner)
r = convert_view(req, pk=fb_id)
print(r.status_code)
assert r.status_code == 200
new_task_id = resp_json(r)['converted_task_id']

print("=== TEST 8: manual deletion of the task directly from the Kanban blob is auto-reconciled on next list() ===")
ws.refresh_from_db()
ws.data['tasks'] = [t for t in ws.data['tasks'] if t['id'] != new_task_id]
ws.save(update_fields=['data'])

req = factory.get(f'/api/playtest-feedback/?project={project.id}')
force_authenticate(req, user=owner)
r = list_view(req)
items = resp_json(r)
item = next(i for i in items if i['id'] == fb_id)
print('converted_task_id after manual kanban deletion + list():', repr(item['converted_task_id']))
assert item['converted_task_id'] == ''

fb_reloaded = PlaytestFeedback.objects.get(id=fb_id)
assert fb_reloaded.converted_task_id == '', "DB row itself must be cleared too, not just the response"

print("=== TEST 9: outsider (no perms at all) cannot pin/status/convert/delete-others-feedback ===")
req = factory.post(f'/api/playtest-feedback/{fb_id}/toggle-pin/')
force_authenticate(req, user=outsider)
r = pin_view(req, pk=fb_id)
print('outsider pin (should 403):', r.status_code)
assert r.status_code == 403

req = factory.delete(f'/api/playtest-feedback/{fb2.id}/')
force_authenticate(req, user=pinner)
r = destroy_view(req, pk=fb2.id)
print('pinner delete someone elses feedback (should 403):', r.status_code)
assert r.status_code == 403

print("\nALL FEEDBACK V3 TESTS PASSED")

# cleanup
PlaytestFeedback.objects.filter(project=project).delete()
from core.models import Role as RoleModel
ProjectMember.objects.filter(project=project).delete()
RoleModel.objects.filter(project=project).delete()
WorkspaceState.objects.filter(key=key).delete()
project.delete()
RoleModel.objects.filter(organisation=org).delete()
OrganisationMember.objects.filter(organisation=org).delete()
org.delete()
for u in [owner, outsider, pinner]:
    u.delete()
print("cleanup done")
