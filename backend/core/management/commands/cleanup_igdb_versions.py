import time
from django.core.management.base import BaseCommand
from core.models import Game
import requests
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

class Command(BaseCommand):
    help = 'Cleans up games that are actually upgrade editions, ports, or have a version_parent on IGDB'

    def handle(self, *args, **options):
        token = get_igdb_token()
        if not token:
            self.stdout.write(self.style.ERROR('Could not get IGDB token'))
            return
            
        headers = {
            'Client-ID': IGDB_CLIENT_ID,
            'Authorization': f'Bearer {token}'
        }
        
        games = Game.objects.exclude(igdb_id__isnull=True)
        total_games = games.count()
        deleted_count = 0
        
        self.stdout.write(f'Checking {total_games} games against IGDB for version parents...')
        
        # Batch query IGDB (up to 50 IDs at a time)
        game_ids = list(games.values_list('igdb_id', flat=True))
        
        batch_size = 50
        for i in range(0, len(game_ids), batch_size):
            batch = game_ids[i:i+batch_size]
            ids_str = ','.join([str(x) for x in batch])
            query = f"fields id, name, category, version_parent, parent_game; where id = ({ids_str}); limit 50;"
            
            try:
                resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=query, timeout=10)
                if resp.status_code == 200:
                    data = resp.json()
                    
                    for igdb_game in data:
                        igdb_id = str(igdb_game['id'])
                        cat = igdb_game.get('category', 0)
                        
                        is_unwanted = False
                        
                        # If it's a different version of a game (e.g. Next Gen Upgrade)
                        if igdb_game.get('version_parent'):
                            is_unwanted = True
                            
                        # If it's a port (11), expanded (10), remaster (9), remake (8)
                        # The user requested no "better versions" or "upgrade editions"
                        elif cat in (8, 9, 10, 11):
                            is_unwanted = True
                            
                        # If it has a parent game but it's not a DLC (1) or Expansion (2)
                        elif igdb_game.get('parent_game') and cat not in (1, 2, 4):
                            is_unwanted = True

                        if is_unwanted:
                            # Delete from local DB
                            local_game = Game.objects.filter(igdb_id=igdb_id).first()
                            if local_game:
                                self.stdout.write(self.style.WARNING(f"Deleting unwanted version: {local_game.title} (IGDB ID: {igdb_id}, Cat: {cat})"))
                                local_game.delete()
                                deleted_count += 1
                else:
                    self.stdout.write(self.style.ERROR(f"IGDB API Error: {resp.status_code}"))
                    
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error checking batch: {e}"))
                
            time.sleep(0.3) # respect rate limit
            
        self.stdout.write(self.style.SUCCESS(f'Finished! Deleted {deleted_count} upgrade/unwanted editions.'))
