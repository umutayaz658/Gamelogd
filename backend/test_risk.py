import os
import requests
import json
import django
import sys

sys.path.append('c:\\Users\\teoma\\Gamelogd\\backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from core.models import Game
from api.services.igdb_service import fetch_game_details

def test_fetch_risk():
    game = Game.objects.filter(title__icontains='RISK').first()
    if not game:
        print("RISK not found in DB")
        return
    
    print(f"Found game: {game.title} (ID: {game.id}, IGDB ID: {game.igdb_id}, details_fetched: {game.details_fetched})")
    
    # Force fetch
    game.details_fetched = False
    game = fetch_game_details(game)
    
    print("--- After fetch ---")
    print(f"Summary: {game.summary}")
    print(f"Dev: {game.developer}")
    print(f"Screenshots: {len(game.screenshots) if game.screenshots else 0}")
    print(f"details_fetched: {game.details_fetched}")

test_fetch_risk()
