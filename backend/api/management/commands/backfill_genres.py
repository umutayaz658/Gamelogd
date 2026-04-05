import os
import time
import requests
from django.core.management.base import BaseCommand
from django.db.models import Q
from core.models import Game
from api.services.steam import fetch_steam_genres


class Command(BaseCommand):
    help = 'Backfills genres for games missing them, using IGDB and Steam APIs'

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview without saving')
        parser.add_argument('--client-id', type=str, help='Twitch Client ID')
        parser.add_argument('--client-secret', type=str, help='Twitch Client Secret')
        parser.add_argument('--limit', type=int, default=0, help='Limit number of games to process (0 = all)')

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        limit = options['limit']

        CLIENT_ID = options.get('client_id') or os.environ.get('IGDB_CLIENT_ID') or 'elkye6v908qd8eb7sn10q9jy907j7w'
        CLIENT_SECRET = options.get('client_secret') or os.environ.get('IGDB_CLIENT_SECRET') or 'bgv30rr6kcqlic5ukc5sn795qnvzcz'

        # Authenticate with IGDB
        access_token = None
        if CLIENT_ID and CLIENT_SECRET:
            try:
                auth_response = requests.post(
                    'https://id.twitch.tv/oauth2/token',
                    params={
                        'client_id': CLIENT_ID,
                        'client_secret': CLIENT_SECRET,
                        'grant_type': 'client_credentials'
                    }
                )
                auth_response.raise_for_status()
                access_token = auth_response.json()['access_token']
                self.stdout.write(self.style.SUCCESS('IGDB authenticated!'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'IGDB auth failed: {e}, will use Steam only'))

        # Find games with empty or null genres
        games_without_genres = Game.objects.filter(
            Q(genres__isnull=True) | Q(genres=[])
        )

        if limit > 0:
            games_without_genres = games_without_genres[:limit]

        total = games_without_genres.count()
        self.stdout.write(f'\nFound {total} games without genres.')

        updated = 0
        failed = 0

        for i, game in enumerate(games_without_genres.iterator()):
            genres = []

            # Strategy 1: IGDB (if we have igdb_id and auth)
            if access_token and game.igdb_id:
                genres = self._fetch_igdb_genres(CLIENT_ID, access_token, game.igdb_id)
                time.sleep(0.25)

            # Strategy 2: IGDB search by name
            if not genres and access_token:
                genres = self._search_igdb_genres(CLIENT_ID, access_token, game.title)
                time.sleep(0.25)

            # Strategy 3: Steam (if we have steam_appid)
            if not genres and game.steam_appid:
                genres = fetch_steam_genres(game.steam_appid)
                time.sleep(0.3)

            if genres:
                if dry_run:
                    self.stdout.write(f'  [{i+1}/{total}] [DRY RUN] {game.title}: {genres}')
                else:
                    game.genres = genres
                    game.save(update_fields=['genres'])
                    self.stdout.write(self.style.SUCCESS(
                        f'  [{i+1}/{total}] {game.title} -> {genres}'
                    ))
                updated += 1
            else:
                self.stdout.write(self.style.WARNING(
                    f'  [{i+1}/{total}] No genres found for: {game.title}'
                ))
                failed += 1

        self.stdout.write(self.style.SUCCESS(
            f'\nDone! Updated: {updated}, Failed: {failed}, Total: {total}'
        ))

    def _fetch_igdb_genres(self, client_id, access_token, igdb_id):
        """Fetch genres from IGDB by igdb_id."""
        try:
            response = requests.post(
                'https://api.igdb.com/v4/games',
                headers={
                    'Client-ID': client_id,
                    'Authorization': f'Bearer {access_token}'
                },
                data=f'fields genres.name; where id = {igdb_id};',
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            if data and data[0].get('genres'):
                return [g['name'] for g in data[0]['genres'] if 'name' in g]
        except Exception:
            pass
        return []

    def _search_igdb_genres(self, client_id, access_token, title):
        """Search IGDB by game title and return genres."""
        try:
            # Escape quotes in title
            safe_title = title.replace('"', '\\"')
            response = requests.post(
                'https://api.igdb.com/v4/games',
                headers={
                    'Client-ID': client_id,
                    'Authorization': f'Bearer {access_token}'
                },
                data=f'fields genres.name; search "{safe_title}"; limit 1;',
                timeout=10
            )
            response.raise_for_status()
            data = response.json()
            if data and data[0].get('genres'):
                return [g['name'] for g in data[0]['genres'] if 'name' in g]
        except Exception:
            pass
        return []
