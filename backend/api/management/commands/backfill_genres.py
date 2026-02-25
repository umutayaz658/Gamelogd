import time
from django.core.management.base import BaseCommand
from core.models import Game
from api.models import LibraryEntry
from api.services.steam import fetch_steam_genres


class Command(BaseCommand):
    help = 'Backfills genres for Steam-imported games that have empty genres'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview without saving')

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # Find games with empty genres that have at least one Steam library entry
        games_without_genres = Game.objects.filter(genres=[]).filter(
            library_entries__platform__iexact='Steam'
        ).distinct()

        total = games_without_genres.count()
        self.stdout.write(f"Found {total} games without genres to backfill.")

        updated = 0
        skipped = 0

        for game in games_without_genres:
            # Get the Steam appid from the library entry
            entry = LibraryEntry.objects.filter(
                game=game, platform__iexact='Steam'
            ).first()

            if not entry:
                skipped += 1
                continue

            # We need the appid - try to find it via Steam API by title
            # Since we don't store appid directly, we'll use the cover image filename
            appid = None
            if game.cover_image and game.cover_image.name:
                # Cover images saved as "{appid}.jpg"
                filename = game.cover_image.name.split('/')[-1]
                if filename.endswith('.jpg'):
                    try:
                        appid = int(filename.replace('.jpg', '').replace('igdb_', ''))
                    except ValueError:
                        pass

            if not appid:
                self.stdout.write(self.style.WARNING(
                    f"  Skipped: {game.title} (no appid found)"
                ))
                skipped += 1
                continue

            genres = fetch_steam_genres(appid)

            if genres:
                if dry_run:
                    self.stdout.write(f"  [DRY RUN] {game.title}: {genres}")
                else:
                    game.genres = genres
                    game.save(update_fields=['genres'])
                    self.stdout.write(self.style.SUCCESS(
                        f"  Updated: {game.title} -> {genres}"
                    ))
                updated += 1
            else:
                self.stdout.write(self.style.WARNING(
                    f"  No genres found: {game.title} (appid={appid})"
                ))
                skipped += 1

            time.sleep(0.3)  # Rate limit protection

        self.stdout.write(self.style.SUCCESS(
            f"\nDone! Updated: {updated}, Skipped: {skipped}, Total: {total}"
        ))
