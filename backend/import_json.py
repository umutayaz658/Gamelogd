import json
import os
import sys
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Game

def import_games():
    with open('games.json', 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    success = 0
    errors = 0
    for item in data:
        if item['model'] == 'core.game':
            fields = item['fields']
            igdb_id = fields.get('igdb_id')
            steam_appid = fields.get('steam_appid')
            
            try:
                # Try to find existing game by igdb_id or steam_appid
                game = None
                if igdb_id:
                    game = Game.objects.filter(igdb_id=igdb_id).first()
                if not game and steam_appid:
                    game = Game.objects.filter(steam_appid=steam_appid).first()
                if not game:
                    # check title match just in case
                    game = Game.objects.filter(title__iexact=fields.get('title')).first()
                    
                if game:
                    # Update existing
                    for key, value in fields.items():
                        setattr(game, key, value)
                    game.save()
                else:
                    # Create new without enforcing PK
                    Game.objects.create(**fields)
                success += 1
            except Exception as e:
                print(f"Error importing {fields.get('title')}: {e}")
                errors += 1
                
    print(f"Import finished. Success: {success}, Errors: {errors}")

if __name__ == '__main__':
    import_games()
