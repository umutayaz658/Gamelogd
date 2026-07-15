import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework.test import APIRequestFactory, force_authenticate
from api.models import User
from core.models import Organisation, OrganisationMember, Project, WorkspaceState
from api.views import OrganisationViewSet, ProjectViewSet
import json

factory = APIRequestFactory()

def resp_json(r):
    r.render()
    return json.loads(r.content)

owner, _ = User.objects.get_or_create(username='__ws_owner', defaults={'email': 'o@t.com'})
admin, _ = User.objects.get_or_create(username='__ws_admin', defaults={'email': 'a@t.com'})
member, _ = User.objects.get_or_create(username='__ws_member', defaults={'email': 'm@t.com'})
outsider, _ = User.objects.get_or_create(username='__ws_outsider', defaults={'email': 'x@t.com'})

org, created = Organisation.objects.get_or_create(slug='__test-org-ws', defaults={'name': 'Test Org WS'})
if created:
    OrganisationMember.objects.create(organisation=org, user=owner, role='owner')
    OrganisationMember.objects.create(organisation=org, user=admin, role='admin')
    OrganisationMember.objects.create(organisation=org, user=member, role='member')
    from api.permission_catalog import create_default_roles
    create_default_roles(org)

update_view = OrganisationViewSet.as_view({'patch': 'partial_update'})
destroy_view = OrganisationViewSet.as_view({'delete': 'destroy'})

print("=== TEST 1: outsider (not even a member) cannot PATCH org ===")
req = factory.patch(f'/api/organisations/{org.slug}/', {'description': 'hacked'}, content_type='application/json')
force_authenticate(req, user=outsider)
r = update_view(req, slug=org.slug)
print(r.status_code)
assert r.status_code == 403

print("=== TEST 2: plain member cannot PATCH org ===")
req = factory.patch(f'/api/organisations/{org.slug}/', {'description': 'hacked'}, content_type='application/json')
force_authenticate(req, user=member)
r = update_view(req, slug=org.slug)
print(r.status_code)
assert r.status_code == 403

print("=== TEST 3: admin CAN PATCH org but CANNOT DELETE it ===")
req = factory.patch(f'/api/organisations/{org.slug}/', {'description': 'edited by admin'}, content_type='application/json')
force_authenticate(req, user=admin)
r = update_view(req, slug=org.slug)
print('admin patch:', r.status_code, resp_json(r).get('description'))
assert r.status_code == 200
assert resp_json(r)['description'] == 'edited by admin'

req = factory.delete(f'/api/organisations/{org.slug}/')
force_authenticate(req, user=admin)
r = destroy_view(req, slug=org.slug)
print('admin delete (should 403):', r.status_code)
assert r.status_code == 403

print("=== TEST 4: owner CAN PATCH org ===")
req = factory.patch(f'/api/organisations/{org.slug}/', {'description': 'edited by owner'}, content_type='application/json')
force_authenticate(req, user=owner)
r = update_view(req, slug=org.slug)
print(r.status_code)
assert r.status_code == 200

print("=== TEST 5: ensure_build_token + github_repo_url on a project ===")
project, created = Project.objects.get_or_create(title='__test-project-ws', owner=owner, organisation=org, defaults={'description': 'x'})
patch_project_view = ProjectViewSet.as_view({'patch': 'partial_update'})
token_view = ProjectViewSet.as_view({'post': 'ensure_build_token'})

req = factory.patch(f'/api/projects/{project.id}/', {'github_repo_url': 'https://github.com/foo/bar'}, content_type='application/json')
force_authenticate(req, user=owner)
r = patch_project_view(req, pk=project.id)
print('patch repo url:', r.status_code, resp_json(r).get('github_repo_url'))
assert r.status_code == 200
assert resp_json(r)['github_repo_url'] == 'https://github.com/foo/bar'

project.refresh_from_db()
assert not project.ci_build_token
req = factory.post(f'/api/projects/{project.id}/ensure-build-token/')
force_authenticate(req, user=owner)
r = token_view(req, pk=project.id)
data = resp_json(r)
print('ensure_build_token:', r.status_code, 'token len:', len(data.get('ci_build_token') or ''))
assert r.status_code == 200
assert data['ci_build_token']
first_token = data['ci_build_token']

# idempotent second call
req = factory.post(f'/api/projects/{project.id}/ensure-build-token/')
force_authenticate(req, user=owner)
r = token_view(req, pk=project.id)
data2 = resp_json(r)
print('second call token unchanged:', data2['ci_build_token'] == first_token)
assert data2['ci_build_token'] == first_token

# client can't override ci_build_token via PATCH (read_only)
req = factory.patch(f'/api/projects/{project.id}/', {'ci_build_token': 'HACKED'}, content_type='application/json')
force_authenticate(req, user=owner)
r = patch_project_view(req, pk=project.id)
print('patch attempt on ci_build_token ignored, still:', resp_json(r)['ci_build_token'] == first_token)
assert resp_json(r)['ci_build_token'] == first_token

print("=== TEST 6: org deletion migrates the project's WorkspaceState row (preserving data) instead of losing it ===")
org_key = f"workspace__org_{org.id}_board_project_{project.id}"
solo_key = f"workspace__solo_board_project_{project.id}"
WorkspaceState.objects.filter(key__in=[org_key, solo_key]).delete()
ws = WorkspaceState.objects.create(key=org_key, organisation=org, user=None, data={'columns': [{'id': 'backlog'}], 'tasks': [{'id': 'task-1', 'title': 'Important task'}]})

req = factory.delete(f'/api/organisations/{org.slug}/')
force_authenticate(req, user=owner)
r = destroy_view(req, slug=org.slug)
print('owner delete org:', r.status_code)
assert r.status_code == 204

assert not Organisation.objects.filter(id=org.id).exists()
project.refresh_from_db()
print('project survived, organisation is now:', project.organisation_id)
assert project.organisation_id is None

migrated = WorkspaceState.objects.filter(key=solo_key).first()
print('migrated row exists:', migrated is not None, '| tasks preserved:', migrated.data.get('tasks') if migrated else None)
assert migrated is not None
assert migrated.user_id == owner.id
assert migrated.organisation_id is None
assert migrated.data['tasks'][0]['title'] == 'Important task'
assert not WorkspaceState.objects.filter(key=org_key).exists()

print("\nALL WORKSPACE SETTINGS BACKEND TESTS PASSED")

# cleanup
WorkspaceState.objects.filter(key__in=[org_key, solo_key]).delete()
project.delete()
for u in [owner, admin, member, outsider]:
    u.delete()
print("cleanup done")
