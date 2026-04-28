---
description: Implementing Secure Authentication & Authorization
---

# Secure Authentication & Authorization Guidelines

This workflow ensures strict user data isolation and secure authentications are maintained across both the Next.js frontend and Django REST Framework backend. Security and privacy are the highest priorities.

## 1. Backend Authorization Rules (Django)
- **Object-Level Permissions:** When building endpoints that modify or delete data (e.g., updating a profile, deleting a post, logging a game), ALWAYS verify that the object belongs to the requester. `IsAuthenticated` is not enough; you must verify ownership.
  - *Example Check:* `if obj.user != request.user: raise PermissionDenied("You do not have permission to modify this.")`
- **Zero Trust Creation:** NEVER trust a `user_id` sent from the frontend client in a POST/PUT payload. Always force the association on the server side using `serializer.save(user=self.request.user)`.
- **Queryset Isolation:** For endpoints returning private data (like direct messages or hidden settings), strictly filter the queryset: `return queryset.filter(user=self.request.user)`.

## 2. Frontend Authentication Rules (Next.js)
- **Token Handling:** The authentication token is stored via `js-cookie` as `access_token`. It must be attached to the `Authorization: Token <token>` header, which is managed centrally in `src/lib/api.ts`. Do not manually attach the token in individual components.
- **Route Protection:** Private pages (e.g., `/settings`, `/messages`) must actively check for the user's authentication state. If unauthenticated, they should gracefully redirect to `/login` without brief flashes of protected content.
- **Cache & State Wiping:** Upon logout, the frontend MUST clear all cached user data. This includes `localStorage` caches (like recommended games) and any global state, ensuring no sensitive data leaks if another user uses the same browser.
