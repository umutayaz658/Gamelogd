from pathlib import Path
import os
import dj_database_url
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent


# Quick-start development settings - unsuitable for production
# See https://docs.djangoproject.com/en/4.2/howto/deployment/checklist/

# SECURITY WARNING: don't run with debug turned on in production!
DEBUG = str(os.environ.get('DEBUG', '0')).lower() in ['1', 'true']

# SECURITY WARNING: keep the secret key used in production secret!
# Never boot production on the well-known insecure default — session/CSRF/token signing
# would be forgeable. Fall back to the dev default only when DEBUG is on.
SECRET_KEY = os.environ.get('SECRET_KEY')
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = 'django-insecure-default-key'
    else:
        raise ImproperlyConfigured('SECRET_KEY environment variable must be set in production.')

ALLOWED_HOSTS = os.environ.get('DJANGO_ALLOWED_HOSTS', 'localhost 127.0.0.1 [::1]').split(' ')


# Application definition

INSTALLED_APPS = [
    'daphne',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'cloudinary_storage',
    'cloudinary',
    'rest_framework',
    'rest_framework.authtoken',
    'corsheaders',
    'core',
    'api',
    'django_filters',
    'channels',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# Never open the API to every origin: it would let any website read authenticated
# responses cross-origin. Rely on the explicit allow-list below instead.
CORS_ALLOW_ALL_ORIGINS = False

# Required so the browser sends/receives the httpOnly auth cookie cross-site during the
# transition and for same-site cookie auth after the API moves to api.gamelogd.net.
CORS_ALLOW_CREDENTIALS = True

CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://gamelogd-coral.vercel.app",
    "https://gamelogd.net",
    "https://www.gamelogd.net",
]

# Vercel preview deployments for THIS project. Anchored to the exact project family
# (gamelogd-coral) rather than "gamelogd.*", which would also match an attacker-registered
# gamelogd-<anything>.vercel.app and — with CORS_ALLOW_CREDENTIALS — let it read authenticated
# responses. For full safety, prefer anchoring on the Vercel team slug or dropping the regex and
# listing preview URLs explicitly.
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://gamelogd-coral(-[a-z0-9]+)*\.vercel\.app$",
]

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://gamelogd-coral.vercel.app",
    "https://gamelogd-production.up.railway.app",
    "https://gamelogd.net",
    "https://www.gamelogd.net",
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    },
}


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases

if os.environ.get('GITHUB_ACTIONS') == 'true':
    DB_ENGINE = 'django.db.backends.sqlite3'
else:
    DB_ENGINE = os.environ.get('DB_ENGINE', 'django.db.backends.postgresql')

DATABASES = {
    'default': {
        'ENGINE': DB_ENGINE,
        'NAME': os.path.join(BASE_DIR, 'db.sqlite3') if DB_ENGINE == 'django.db.backends.sqlite3' else os.environ.get('DB_NAME', 'gamelogd'),
        'USER': os.environ.get('DB_USER', 'postgres'),
        'PASSWORD': os.environ.get('DB_PASSWORD', 'postgres'),
        'HOST': os.environ.get('DB_HOST', 'localhost'),
        'PORT': os.environ.get('DB_PORT', '5432'),
    }
}

# Override with DATABASE_URL if provided (e.g. on Railway)
if os.environ.get('DATABASE_URL'):
    DATABASES['default'] = dj_database_url.config(default=os.environ.get('DATABASE_URL'), conn_max_age=600, ssl_require=False)


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
STATIC_URL = 'static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')

MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')

# Storage configuration (Django 5.0+)
STORAGES = {
    "default": {
        "BACKEND": "cloudinary_storage.storage.MediaCloudinaryStorage" if os.environ.get('CLOUDINARY_URL') else "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    },
}

# Legacy storage configurations for compatibility with older third-party packages (like django-cloudinary-storage)
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"
DEFAULT_FILE_STORAGE = "cloudinary_storage.storage.MediaCloudinaryStorage" if os.environ.get('CLOUDINARY_URL') else "django.core.files.storage.FileSystemStorage"

# Do not crash the build if some static files referenced in CSS files (e.g. source maps, missing svgs) are missing.
WHITENOISE_MANIFEST_STRICT = False



# Cloudinary Setup
if os.environ.get('CLOUDINARY_URL'):
    CLOUDINARY_STORAGE = {
        'CLOUD_NAME': os.environ.get('CLOUDINARY_CLOUD_NAME'),
        'API_KEY': os.environ.get('CLOUDINARY_API_KEY'),
        'API_SECRET': os.environ.get('CLOUDINARY_API_SECRET'),
    }

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'api.User'

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        # Accepts the token from the standard Authorization header OR from an httpOnly
        # cookie (CSRF-enforced). Subclasses TokenAuthentication, so header clients still work.
        'api.authentication.CookieTokenAuthentication',
        'rest_framework.authentication.SessionAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticatedOrReadOnly',
    ],
    # Rate limiting:
    #  - ScopedRateThrottle: tight per-endpoint caps on the credential/OTP endpoints (below).
    #  - AnonRateThrottle: caps unauthenticated abuse — bulk scraping of the public feed/explore/
    #    user-search surfaces (e.g. harvesting) and hammering the AllowAny endpoints.
    #  - UserRateThrottle: a generous backstop against runaway automated activity (message/follow/
    #    post spam) set high enough that normal, request-heavy SPA browsing never hits it.
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.ScopedRateThrottle',
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'login': '10/min',
        'verify_email': '10/min',
        'resend_verification': '3/min',
        'register': '5/min',
        'anon': '120/min',
        'user': '600/min',
    },
}

STEAM_API_KEY = os.environ.get('STEAM_API_KEY')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '47915710744-n0ou1hdfknaur2ijac5gntqopbruoar1.apps.googleusercontent.com')
CRON_SECRET = os.environ.get('CRON_SECRET')
if not CRON_SECRET:
    if DEBUG:
        CRON_SECRET = 'gamelogd-local-cron-secret-key-12345'
    else:
        raise ImproperlyConfigured('CRON_SECRET environment variable must be set in production.')

# OAuth and API Keys
MICROSOFT_CLIENT_ID = os.environ.get('MICROSOFT_CLIENT_ID')
MICROSOFT_CLIENT_SECRET = os.environ.get('MICROSOFT_CLIENT_SECRET')
FRONTEND_URL = os.environ.get('FRONTEND_URL', 'http://localhost:3000')
OPENXBL_API_KEY = os.environ.get('OPENXBL_API_KEY')

# Email configuration
# In development (Docker local): print emails to console (terminal logs)
# In production: use Resend SMTP to send real emails from noreply@gamelogd.net
EMAIL_HOST_PASSWORD = (
    os.environ.get('EMAIL_HOST_PASSWORD') or 
    os.environ.get('resend_api') or 
    os.environ.get('RESEND_API_KEY')
)

if EMAIL_HOST_PASSWORD:
    # Production: Resend SMTP (or any SMTP provider)
    EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
    EMAIL_HOST = os.environ.get('EMAIL_HOST', 'smtp.resend.com')
    EMAIL_PORT = int(os.environ.get('EMAIL_PORT', 587))
    EMAIL_USE_TLS = True
    EMAIL_USE_SSL = False
    EMAIL_HOST_USER = os.environ.get('EMAIL_HOST_USER', 'resend')
    DEFAULT_FROM_EMAIL = os.environ.get('DEFAULT_FROM_EMAIL', 'Gamelogd <noreply@gamelogd.net>')
    EMAIL_TIMEOUT = 10  # Seconds - prevent SMTP hangs from killing gunicorn workers
else:
    # Development: print emails to console (docker logs backend)
    EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
    DEFAULT_FROM_EMAIL = 'Gamelogd <noreply@gamelogd.net>'

SUPPORT_EMAIL = os.environ.get('SUPPORT_EMAIL', 'support@gamelogd.net')

# Security Headers Settings
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# Production-only transport hardening. Guarded by DEBUG so local http:// dev is unaffected.
if not DEBUG:
    # Django sits behind a TLS-terminating proxy (Railway) — trust its forwarded scheme.
    SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
    SECURE_SSL_REDIRECT = True
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = 31536000  # 1 year
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Cookie SameSite: 'Lax' lets first-party navigation carry cookies while blocking most
# cross-site sends. The CSRF cookie must be readable by JS so the SPA can echo it.
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_HTTPONLY = False

# When the frontend and API live on different subdomains of the same site (e.g.
# gamelogd.net + api.gamelogd.net in cookie-auth mode), set CSRF_COOKIE_DOMAIN=.gamelogd.net
# so the frontend JS can read the csrftoken cookie the API sets and echo it back as the
# X-CSRFToken header. Leave unset (host-only cookie) for header-mode / same-origin setups.
CSRF_COOKIE_DOMAIN = os.environ.get('CSRF_COOKIE_DOMAIN') or None

# Domain for the httpOnly auth cookie (see api/authentication.py set_auth_cookie).
# MUST be the shared parent domain (e.g. .gamelogd.net) when the API is on api.gamelogd.net
# but the frontend is on gamelogd.net — otherwise the cookie is host-only to the API host,
# the frontend's Next.js middleware can't see it, and every protected route bounces back to
# /login even though the session is valid. Leave unset (host-only) for same-origin setups.
AUTH_COOKIE_DOMAIN = os.environ.get('AUTH_COOKIE_DOMAIN') or None


