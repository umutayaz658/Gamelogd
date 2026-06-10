import os
import requests
import django
import sys
sys.path.append('c:\\Users\\teoma\\Gamelogd\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID
token = get_igdb_token()
headers = {'Client-ID': IGDB_CLIENT_ID, 'Authorization': f'Bearer {token}'}
q = 'search "Half-Life Deathmatch: Source"; fields id, name; limit 10;'
resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=q)
print(resp.json())
