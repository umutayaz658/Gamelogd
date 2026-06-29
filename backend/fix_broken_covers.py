"""
Fast script to fix broken local cover images by replacing them with IGDB URLs.
"""
import os
import time
import requests
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Game
from django.db.models import Q
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

def main():
    print("=" * 60)
    print("FIXING BROKEN LOCAL COVERS VIA IGDB")
    print("=" * 60)

    # Find games where cover_image is empty, null, or doesn't start with http
    broken_games = Game.objects.filter(Q(cover_image='') | Q(cover_image__isnull=True) | ~Q(cover_image__startswith='http')).exclude(igdb_id__isnull=True).order_by('id')
    total = broken_games.count()
    
    print(f"Found {total} games with broken local covers.")
    if total == 0:
        print("Nothing to do.")
        return

    token = get_igdb_token()
    if not token:
        print("Failed to get IGDB token.")
        return

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    success = 0
    chunk_size = 300
    games_list = list(broken_games)

    for chunk_start in range(0, total, chunk_size):
        chunk_end = min(chunk_start + chunk_size, total)
        games_batch = games_list[chunk_start:chunk_end]
        
        game_map = {g.igdb_id: g for g in games_batch}
        id_list_str = ",".join(str(g.igdb_id) for g in games_batch)

        print(f"Processing batch {chunk_start} to {chunk_end} of {total}...")
        
        query = f"""
            fields cover.url;
            where id = ({id_list_str});
            limit {chunk_size};
        """
        
        try:
            response = requests.post(
                'https://api.igdb.com/v4/games',
                headers=headers,
                data=query,
                timeout=30
            )
            response.raise_for_status()
            data = response.json()
            
            games_to_update = []
            
            for igdb_data in data:
                gid = igdb_data.get('id')
                if gid not in game_map:
                    continue
                    
                game = game_map[gid]
                
                if 'cover' in igdb_data and 'url' in igdb_data['cover']:
                    cover_url = igdb_data['cover']['url']
                    if cover_url.startswith('//'):
                        cover_url = f"https:{cover_url}"
                    game.cover_image = cover_url.replace('t_thumb', 't_cover_big')
                    games_to_update.append(game)
                    success += 1
            
            if games_to_update:
                Game.objects.bulk_update(games_to_update, ['cover_image'])
                
            time.sleep(1)
            
        except Exception as e:
            print(f"FAILED BATCH: {e}")
            time.sleep(2)

    print(f"\nCompleted! Fixed {success} broken covers.")

if __name__ == "__main__":
    main()
