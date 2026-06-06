import os
import django
import sys
import time
import requests

# Setup Django environment
sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Game
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

def chunk_list(lst, n):
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def fix_covers():
    games = Game.objects.filter(cover_image='', igdb_id__isnull=False)
    total = games.count()
    print(f"Found {total} games missing covers with igdb_ids.")

    if total == 0:
        return

    token = get_igdb_token()
    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    }

    game_list = list(games)
    # IGDB max limit is 500
    chunks = list(chunk_list(game_list, 500))
    updated_count = 0

    for idx, chunk in enumerate(chunks):
        print(f"Processing chunk {idx+1}/{len(chunks)}...")
        igdb_ids = [str(g.igdb_id) for g in chunk]
        id_str = ",".join(igdb_ids)

        query = f"fields id, cover.url; where id = ({id_str}); limit 500;"

        try:
            response = requests.post(
                'https://api.igdb.com/v4/games',
                headers=headers,
                data=query,
                timeout=15
            )
            response.raise_for_status()
            data = response.json()
            
            # Map IGDB ID to cover URL
            cover_map = {}
            for item in data:
                if 'cover' in item and 'url' in item['cover']:
                    url = item['cover']['url']
                    if url.startswith('//'):
                        url = f"https:{url}"
                    # Upgrade image quality
                    url = url.replace('t_thumb', 't_cover_big')
                    cover_map[item['id']] = url

            # Update DB
            update_list = []
            for g in chunk:
                if g.igdb_id in cover_map:
                    g.cover_image = cover_map[g.igdb_id]
                    update_list.append(g)

            if update_list:
                Game.objects.bulk_update(update_list, ['cover_image'])
                updated_count += len(update_list)
            
            # Small delay to respect rate limits
            time.sleep(0.5)

        except Exception as e:
            print(f"Error fetching chunk {idx+1}: {e}")

    print(f"Successfully updated {updated_count} covers.")

if __name__ == '__main__':
    fix_covers()
