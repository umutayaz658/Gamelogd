import sys
import os
import django
import requests
import json

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.contrib.auth import get_user_model

def get_xbox_data():
    User = get_user_model()
    try:
        u = User.objects.get(username='teomanadmin')
    except Exception as e:
        print(f"Error getting user: {e}")
        return

    xuid = getattr(u, 'xbox_xuid', None)
    if not xuid:
        # Check standard fields if they exist
        pass

    # The tokens are not saved in User model persistently, they are only in session!
    print("User fields:", [f.name for f in User._meta.fields])

if __name__ == '__main__':
    get_xbox_data()
