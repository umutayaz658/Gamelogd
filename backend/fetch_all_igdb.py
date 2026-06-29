"""
Background script to fetch IGDB details for all games missing them.
This script is designed to handle thousands of games (e.g. 7500+) safely,
respecting rate limits and handling transient errors.

Run: docker-compose exec -d backend python fetch_all_igdb.py
"""
import os
import sys
import time
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from core.models import Game
from api.services.igdb_service import fetch_game_details

def main():
    print("=" * 60)
    print("BULK IGDB FETCH SCRIPT")
    print("=" * 60)

    # Fetch all games that need details
    games_needing_details = Game.objects.filter(details_fetched=False).order_by('id')
    total = games_needing_details.count()
    
    print(f"Found {total} games needing IGDB details.")
    if total == 0:
        print("Nothing to do.")
        return

    success = 0
    errors = 0
    
    # Process in chunks to avoid large memory queries
    chunk_size = 500
    for chunk_start in range(0, total, chunk_size):
        chunk_end = min(chunk_start + chunk_size, total)
        print(f"\nProcessing batch {chunk_start} to {chunk_end} of {total}...")
        
        # Slicing the queryset to process in batches
        games_batch = list(games_needing_details[chunk_start:chunk_end])
        
        for i, game in enumerate(games_batch, chunk_start + 1):
            print(f"[{i}/{total}] {game.id}: {game.title[:40]}... ", end="", flush=True)
            try:
                # fetch_game_details handles rate limit intrinsically? 
                # Wait, fetch_game_details in igdb_service.py does NOT have a sleep.
                # So we must add sleep here to respect IGDB's 4 requests/sec limit.
                fetch_game_details(game)
                success += 1
                print("OK")
                time.sleep(0.3)
            except Exception as e:
                errors += 1
                print(f"FAILED: {e}")
                time.sleep(1.0) # sleep longer on error

    print(f"\n{'=' * 60}")
    print("BULK IGDB FETCH COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total processed: {total}")
    print(f"Success: {success}")
    print(f"Errors: {errors}")
    print(f"Final games with IGDB details: {Game.objects.filter(details_fetched=True).count()}")

if __name__ == "__main__":
    main()
