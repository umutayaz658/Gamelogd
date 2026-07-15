from rest_framework import permissions

class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit or delete it.
    Supports models with `user`, `owner`, or `recruiter` fields.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        if hasattr(obj, 'user'):
            return obj.user == request.user
        elif hasattr(obj, 'owner'):
            return obj.owner == request.user
        elif hasattr(obj, 'recruiter'):
            return obj.recruiter == request.user
        elif hasattr(obj, 'author'):
            return obj.author == request.user

        return False

class OrganisationAccessPermission(permissions.BasePermission):
    """
    Custom permission for Organisations:
    - Anyone can read.
    - Owner or Admin can update.
    - Only the Owner can delete (deleting an org is the most catastrophic action available —
      cascades to its roles/members/WorkspaceState rows, see OrganisationViewSet.destroy()).
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True

        member = obj.members.filter(user=request.user).first()
        if not member:
            return False

        if request.method == 'DELETE':
            return member.role == 'owner'

        return member.role in ('owner', 'admin')


class ProjectAccessPermission(permissions.BasePermission):
    """
    Custom permission for Projects:
    - Anyone can read.
    - Owner or Admin can update or delete.
    - Editor can update, but NOT delete.
    """
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
            
        # Check if user is owner or admin of the project's organisation
        if hasattr(obj, 'organisation') and obj.organisation:
            if obj.organisation.members.filter(user=request.user, role__in=['owner', 'admin']).exists():
                return True
            
        if hasattr(obj, 'owner') and hasattr(obj, 'members'):
            if obj.owner == request.user:
                return True
            
            if obj.members.filter(user=request.user, role='admin').exists():
                return True
                
            if request.method in ['PUT', 'PATCH']:
                return obj.members.filter(user=request.user, role='editor').exists()
                
        return False
