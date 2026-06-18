import os
import django
import requests

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Game
from django.db.models import Q
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

broken_games = Game.objects.filter(Q(cover_image='') | Q(cover_image__isnull=True) | ~Q(cover_image__startswith='http')).exclude(igdb_id__isnull=True).order_by('id')
total = broken_games.count()

print(f"Found {total} games with broken local covers.")

for g in broken_games:
    print(f"ID: {g.id}, IGDB ID: {g.igdb_id}, Title: {g.title}, Cover: '{g.cover_image}'")

if total > 0:
    id_list_str = ",".join(str(g.igdb_id) for g in broken_games[:10])
    print("Querying IGDB for:", id_list_str)
    
    token = get_igdb_token()
    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }
    
    query = f"""
        fields name, cover.url;
        where id = ({id_list_str});
        limit 10;
    """
    
    try:
        response = requests.post(
            'https://api.igdb.com/v4/games',
            headers=headers,
            data=query,
            timeout=30
        )
        print("IGDB STATUS:", response.status_code)
        print("IGDB RESPONSE:", response.json())
    except Exception as e:
        print("ERROR:", e)
