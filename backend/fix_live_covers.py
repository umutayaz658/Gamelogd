import os
import django
import sys
import time
import requests

sys.path.append('/app')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Game
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID
from api.services.steam import get_steam_cover_url

def fix_live_covers():
    # Find all games where cover_image does not start with 'http'
    # This covers local files 'games/20.jpg' or empty strings
    games = Game.objects.exclude(cover_image__startswith='http')
    
    steam_games = [g for g in games if g.steam_appid]
    igdb_games = [g for g in games if g.igdb_id and not g.steam_appid]

    print(f"Found {len(steam_games)} games needing Steam covers.")
    print(f"Found {len(igdb_games)} games needing IGDB covers.")

    # Fix Steam covers instantly
    update_steam = []
    for g in steam_games:
        # Steam CDN URL can be constructed directly without API calls
        cover_url = f"https://steamcdn-a.akamaihd.net/steam/apps/{g.steam_appid}/library_600x900.jpg"
        g.cover_image = cover_url
        update_steam.append(g)
    
    if update_steam:
        Game.objects.bulk_update(update_steam, ['cover_image'])
        print(f"Fixed {len(update_steam)} Steam covers instantly.")

    # Fix IGDB covers
    if not igdb_games:
        return

    def chunk_list(lst, n):
        for i in range(0, len(lst), n):
            yield lst[i:i + n]

    token = get_igdb_token()
    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}',
        'Accept': 'application/json'
    }

    chunks = list(chunk_list(igdb_games, 500))
    updated_count = 0

    for idx, chunk in enumerate(chunks):
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
            
            cover_map = {}
            for item in data:
                if 'cover' in item and 'url' in item['cover']:
                    url = item['cover']['url']
                    if url.startswith('//'):
                        url = f"https:{url}"
                    url = url.replace('t_thumb', 't_cover_big')
                    cover_map[item['id']] = url

            update_list = []
            for g in chunk:
                if g.igdb_id in cover_map:
                    g.cover_image = cover_map[g.igdb_id]
                    update_list.append(g)

            if update_list:
                Game.objects.bulk_update(update_list, ['cover_image'])
                updated_count += len(update_list)
            
            time.sleep(0.5)

        except Exception as e:
            print(f"Error fetching chunk {idx+1}: {e}")

    print(f"Fixed {updated_count} IGDB covers.")

if __name__ == '__main__':
    fix_live_covers()
