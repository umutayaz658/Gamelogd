"""
Full local database sync script.
1. Clears existing games and library entries
2. Re-syncs full Steam library (games, genres, covers, playtime)
3. Fetches IGDB details for all synced games (summary, screenshots, developer, publisher)

Run: docker-compose exec backend python sync_local.py
"""
import os
import sys
import time
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from api.services.steam import fetch_steam_library
from api.services.igdb_service import fetch_game_details
from api.models import User, LibraryEntry
from core.models import Game

def main():
    print("=" * 60)
    print("STEP 1: Clearing existing game data for clean sync")
    print("=" * 60)

    lib_count = LibraryEntry.objects.count()
    game_count = Game.objects.count()
    print(f"Deleting {lib_count} library entries...")
    LibraryEntry.objects.all().delete()
    print(f"Deleting {game_count} games...")
    Game.objects.all().delete()
    print("Database cleared.\n")

    # ── STEP 2: Steam Sync ──
    print("=" * 60)
    print("STEP 2: Syncing Steam libraries")
    print("=" * 60)

    users_with_steam = User.objects.exclude(steam_id__isnull=True).exclude(steam_id="")
    print(f"Found {users_with_steam.count()} user(s) with Steam ID.\n")

    for user in users_with_steam:
        print(f"--- Syncing: {user.username} (steam_id: {user.steam_id}) ---")
        try:
            stats = fetch_steam_library(user.id, user.steam_id)
            print(f"  Total games from Steam: {stats['total']}")
            print(f"  Synced to library:      {stats['synced']}")
            print(f"  New games created:      {stats['created']}")
            print(f"  Cover images fixed:     {stats['cover_fixed']}")
            print(f"  Errors:                 {stats['errors']}")
            if stats.get("error_details"):
                print("  First 5 errors:")
                for err in stats["error_details"][:5]:
                    print(f"    - {err}")
        except Exception as e:
            print(f"  SYNC FAILED: {e}")

    # ── STEP 3: IGDB Details ──
    print(f"\n{'=' * 60}")
    print("STEP 3: Fetching IGDB details for all games")
    print("=" * 60)

    all_games = Game.objects.filter(details_fetched=False)
    total = all_games.count()
    print(f"Found {total} games needing IGDB details.\n")

    success = 0
    errors = 0
    for i, game in enumerate(all_games, 1):
        try:
            print(f"[{i}/{total}] {game.title}...", end=" ", flush=True)
            fetch_game_details(game)
            success += 1
            print("OK")
            # Rate limiting - IGDB allows 4 requests/second
            time.sleep(0.3)
        except Exception as e:
            errors += 1
            print(f"FAILED: {e}")
            time.sleep(0.5)

    print(f"\nIGDB fetch complete: {success} OK, {errors} errors")

    # ── SUMMARY ──
    print(f"\n{'=' * 60}")
    print("FINAL DATABASE SUMMARY")
    print(f"{'=' * 60}")
    print(f"Total Games:             {Game.objects.count()}")
    print(f"Games with genres:       {Game.objects.exclude(genres__isnull=True).exclude(genres=[]).count()}")
    print(f"Games with covers:       {Game.objects.exclude(cover_image='').exclude(cover_image__isnull=True).count()}")
    print(f"Games with steam_appid:  {Game.objects.exclude(steam_appid__isnull=True).count()}")
    print(f"Games with IGDB details: {Game.objects.filter(details_fetched=True).count()}")
    print(f"Games with summary:      {Game.objects.exclude(summary='').count()}")
    print(f"Games with screenshots:  {Game.objects.exclude(screenshots=[]).count()}")
    print(f"Games with developer:    {Game.objects.exclude(developer='').count()}")
    print(f"Total Library Entries:   {LibraryEntry.objects.count()}")
    print(f"Entries with playtime>0: {LibraryEntry.objects.filter(playtime_forever__gt=0).count()}")
    print(f"Total Users:             {User.objects.count()}")
    print(f"\nDone!")

if __name__ == "__main__":
    main()
