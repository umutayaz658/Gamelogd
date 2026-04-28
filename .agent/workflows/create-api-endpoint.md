---
description: Creating a new API endpoint in the Django backend safely
---

# Creating a New Backend API Endpoint

Standard procedure for adding a new feature or API endpoint to the Django backend to maintain a secure and professional architecture.

## 1. Define the Model
- Create or modify the model in `models.py`. 
- Ensure proper relationships (ForeignKeys, ManyToMany) and `on_delete` behaviors.
- Generate migrations: `python manage.py makemigrations` and review the generated file for safety.

## 2. Create the Serializer
- Create a `ModelSerializer` in `serializers.py`.
- Define `fields = '__all__'` or explicitly list fields.
- Make sure sensitive fields (like passwords or tokens) are marked `write_only=True` or excluded.

## 3. Build the View / ViewSet
- Prefer `viewsets.ModelViewSet` for standard CRUD operations in `views.py`.
- **Security Check:** Always specify `permission_classes`. E.g., `[permissions.IsAuthenticated]` for private data, or `[permissions.IsAuthenticatedOrReadOnly]` for public feeds.
- If performing custom actions (e.g., specific logic on an item), use the `@action(detail=True, methods=['post'])` decorator.
- Use `request.user` to automatically associate creations with the logged-in user rather than accepting user IDs from the client.

## 4. Register the URL
- Add the ViewSet to the DefaultRouter in `urls.py`.

## 5. Security & Verification
- Check for N+1 query problems using `select_related` or `prefetch_related` in `get_queryset`.
- Test the endpoint locally to ensure it doesn't return 500 Server Errors on missing data.
