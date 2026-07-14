"""
Cookie-aware token authentication.

Goal: stop exposing the auth token to JavaScript. The token is delivered to the browser
as an httpOnly + Secure + SameSite cookie (see `set_auth_cookie`), so a compromised page
cannot read it via `document.cookie`. This class authenticates a request from that cookie
when no `Authorization` header is present.

Backward compatible: the standard `Authorization: Token <key>` header still works (mobile /
legacy / server-to-server clients), so this can be deployed before the frontend switches to
cookie mode. Header-authenticated requests need no CSRF token (they can't be forged by a
browser); cookie-authenticated requests DO enforce CSRF, because the browser sends the
cookie automatically and would otherwise be open to cross-site request forgery.
"""

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework.authentication import (
    TokenAuthentication,
    get_authorization_header,
)

AUTH_COOKIE_NAME = 'auth_token'
# 30 days, matching the previous 7-day JS cookie is fine too; DRF tokens don't expire
# server-side, so this only bounds how long the browser keeps sending it.
AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30


class _EnforceCsrf(CsrfViewMiddleware):
    def _reject(self, request, reason):
        # Return the reason instead of an HttpResponse so the caller can raise cleanly.
        return reason


class CookieTokenAuthentication(TokenAuthentication):
    def authenticate(self, request):
        # Prefer the standard header path (no CSRF needed for non-browser clients).
        if get_authorization_header(request):
            return super().authenticate(request)

        token_key = request.COOKIES.get(AUTH_COOKIE_NAME)
        if not token_key:
            return None

        user, token = self.authenticate_credentials(token_key)
        self._enforce_csrf(request)
        return (user, token)

    def _enforce_csrf(self, request):
        check = _EnforceCsrf(lambda req: None)
        check.process_request(request)
        reason = check.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f'CSRF Failed: {reason}')


def set_auth_cookie(response, token_key):
    """Attach the httpOnly auth cookie to a login response.

    The cookie is scoped to AUTH_COOKIE_DOMAIN (e.g. .gamelogd.net) when set, so it is sent
    to both the frontend (gamelogd.net) and the API (api.gamelogd.net). Without a shared
    parent domain the cookie stays host-only to the API host and the frontend middleware
    can't see it, trapping the user on /login despite a valid session.
    """
    response.set_cookie(
        AUTH_COOKIE_NAME,
        token_key,
        max_age=AUTH_COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite='Lax',
        path='/',
        domain=getattr(settings, 'AUTH_COOKIE_DOMAIN', None),
    )
    return response


def clear_auth_cookie(response):
    """Remove the httpOnly auth cookie (logout). Domain must match set_auth_cookie's."""
    response.delete_cookie(
        AUTH_COOKIE_NAME,
        path='/',
        samesite='Lax',
        domain=getattr(settings, 'AUTH_COOKIE_DOMAIN', None),
    )
    return response
