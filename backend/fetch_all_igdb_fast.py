"""
Fast background script to bulk fetch IGDB details for all games missing them.
Fetches in batches of 500 using IGDB's multi-ID where clause.
"""
import os
import time
import requests
import datetime
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Game
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

def main():
    print("=" * 60)
    print("FAST BULK IGDB FETCH SCRIPT")
    print("=" * 60)

    # We only bulk fetch games that ALREADY have an igdb_id.
    games_needing_details = Game.objects.filter(details_fetched=False, igdb_id__isnull=False).order_by('id')
    total = games_needing_details.count()
    
    print(f"Found {total} games needing IGDB details (with igdb_id).")
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
    errors = 0
    
    chunk_size = 300 # IGDB limit is 500, we use 300 to be safe with response size
    games_list = list(games_needing_details)

    for chunk_start in range(0, total, chunk_size):
        chunk_end = min(chunk_start + chunk_size, total)
        games_batch = games_list[chunk_start:chunk_end]
        
        # Mapping for quick lookup
        game_map = {g.igdb_id: g for g in games_batch}
        id_list_str = ",".join(str(g.igdb_id) for g in games_batch)

        print(f"\nProcessing batch {chunk_start} to {chunk_end} of {total}...")
        
        query = f"""
            fields summary, storyline, url, cover.url, first_release_date,
                   involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
                   platforms.name, screenshots.url, genres.name;
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
            
            # Update games
            games_to_update = []
            
            for igdb_data in data:
                gid = igdb_data.get('id')
                if gid not in game_map:
                    continue
                    
                game = game_map[gid]
                
                game.summary = igdb_data.get('summary', '')
                game.description = igdb_data.get('storyline', '')
                game.igdb_url = igdb_data.get('url', '')

                if 'first_release_date' in igdb_data and not game.release_date:
                    try:
                        game.release_date = datetime.datetime.fromtimestamp(igdb_data['first_release_date']).strftime('%Y-%m-%d')
                    except Exception:
                        pass

                if 'cover' in igdb_data and 'url' in igdb_data['cover'] and not game.cover_image:
                    cover_url = igdb_data['cover']['url']
                    if cover_url.startswith('//'):
                        cover_url = f"https:{cover_url}"
                    game.cover_image = cover_url.replace('t_thumb', 't_cover_big')

                companies = igdb_data.get('involved_companies', [])
                devs, pubs = [], []
                for c in companies:
                    if 'company' in c and 'name' in c['company']:
                        name = c['company']['name']
                        if c.get('developer'): devs.append(name)
                        if c.get('publisher'): pubs.append(name)
                
                game.developer = ', '.join(devs)
                game.publisher = ', '.join(pubs)

                platforms = igdb_data.get('platforms', [])
                game.platforms = [p['name'] for p in platforms if 'name' in p]

                screenshots = igdb_data.get('screenshots', [])
                urls = []
                for s in screenshots:
                    if 'url' in s:
                        url = s['url']
                        if url.startswith('//'): url = f"https:{url}"
                        urls.append(url.replace('t_thumb', 't_screenshot_huge'))
                game.screenshots = urls

                genres = igdb_data.get('genres', [])
                if genres:
                    game.genres = [g['name'] for g in genres if 'name' in g]

                game.details_fetched = True
                games_to_update.append(game)
                success += 1
            
            # Bulk update
            if games_to_update:
                Game.objects.bulk_update(
                    games_to_update, 
                    ['summary', 'description', 'igdb_url', 'release_date', 'cover_image', 
                     'developer', 'publisher', 'platforms', 'screenshots', 'genres', 'details_fetched']
                )
            
            # Mark the ones not found in IGDB as fetched so we don't query again
            missing = set(game_map.keys()) - set([d.get('id') for d in data])
            missing_games = []
            for m_id in missing:
                mg = game_map[m_id]
                mg.details_fetched = True
                missing_games.append(mg)
            
            if missing_games:
                Game.objects.bulk_update(missing_games, ['details_fetched'])
                
            print(f"Batch completed. Found {len(games_to_update)}/{len(games_batch)} games in IGDB.")
            time.sleep(1) # Respect 4 req/sec limit just in case
            
        except Exception as e:
            errors += len(games_batch)
            print(f"FAILED BATCH: {e}")
            time.sleep(5)

    print(f"\n{'=' * 60}")
    print("FAST BULK IGDB FETCH COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total processed: {total}")
    print(f"Success (found): {success}")
    print(f"Final games with IGDB details: {Game.objects.filter(details_fetched=True).count()}")

if __name__ == "__main__":
    main()
