import os
import django
import requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

token = get_igdb_token()
headers = {
    'Client-ID': IGDB_CLIENT_ID,
    'Authorization': f'Bearer {token}'
}

# Try the query
igdb_query = """
    where name ~ *"rockstar"*;
    fields name, logo.url;
    limit 5;
"""

try:
    response = requests.post(
        'https://api.igdb.com/v4/companies',
        headers=headers,
        data=igdb_query,
        timeout=10
    )
    print("STATUS:", response.status_code)
    print("RESPONSE:", response.json())
except Exception as e:
    print("ERROR:", e)
