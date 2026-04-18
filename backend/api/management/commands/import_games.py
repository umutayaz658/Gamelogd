import os
import requests
import time
from datetime import datetime
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from django.db.models import Q, Count
from core.models import Game


class Command(BaseCommand):
    help = 'Mass imports games from IGDB API with pagination, deduplication, and cover downloads'

    def add_arguments(self, parser):
        parser.add_argument('--client-id', type=str, help='Twitch Client ID')
        parser.add_argument('--client-secret', type=str, help='Twitch Client Secret')
        parser.add_argument('--max-games', type=int, default=10000, help='Maximum total games to import')
        parser.add_argument('--batch-size', type=int, default=500, help='Games per API call (max 500)')
        parser.add_argument('--start-offset', type=int, default=0, help='Starting offset')
        parser.add_argument('--skip-covers', action='store_true', help='Skip downloading cover images (faster)')
        parser.add_argument('--dedupe-only', action='store_true', help='Only run deduplication, skip import')

    def handle(self, *args, **options):
        if options['dedupe_only']:
            self._deduplicate_games()
            return

        CLIENT_ID = options['client_id'] or os.environ.get('IGDB_CLIENT_ID') or 'elkye6v908qd8eb7sn10q9jy907j7w'
        CLIENT_SECRET = options['client_secret'] or os.environ.get('IGDB_CLIENT_SECRET') or 'bgv30rr6kcqlic5ukc5sn795qnvzcz'

        if not CLIENT_ID or not CLIENT_SECRET:
            self.stdout.write(self.style.ERROR('Client ID and Secret are required.'))
            return

        # Step 1: Authenticate
        access_token = self._authenticate(CLIENT_ID, CLIENT_SECRET)
        if not access_token:
            return

        # Step 2: Mass import
        max_games = options['max_games']
        batch_size = min(options['batch_size'], 500)
        start_offset = options['start_offset']
        skip_covers = options['skip_covers']

        headers = {
            'Client-ID': CLIENT_ID,
            'Authorization': f'Bearer {access_token}'
        }

        total_created = 0
        total_updated = 0
        total_errors = 0
        total_covers = 0
        offset = start_offset

        existing_before = Game.objects.count()
        self.stdout.write(f'\nStarting mass import. Current game count: {existing_before}')
        self.stdout.write(f'Target: up to {max_games} games, batch size: {batch_size}\n')

        current_ts = int(time.time())

        # Multiple queries to get comprehensive game coverage
        queries = [
            # 1. Top rated games (most popular)
            ('Top Rated', f'fields name, first_release_date, cover.url, genres.name; sort total_rating_count desc; where total_rating_count > 5 & first_release_date <= {current_ts};'),
            # 2. Most followed games
            ('Most Followed', f'fields name, first_release_date, cover.url, genres.name; sort follows desc; where follows > 1 & first_release_date <= {current_ts};'),
            # 3. Most hyped games
            ('Most Hyped', f'fields name, first_release_date, cover.url, genres.name; sort hypes desc; where hypes > 1 & first_release_date <= {current_ts};'),
            # 4. Recently released
            ('Recent Releases', f'fields name, first_release_date, cover.url, genres.name; sort first_release_date desc; where first_release_date != null & first_release_date <= {current_ts};'),
            # 5. Classic games (by rating)
            ('Classics', f'fields name, first_release_date, cover.url, genres.name; sort total_rating desc; where total_rating > 70 & total_rating_count > 10 & first_release_date <= {current_ts};'),
            # 6. All remaining with any rating (catch-all)
            ('Rated Games', f'fields name, first_release_date, cover.url, genres.name; sort total_rating_count desc; where first_release_date <= {current_ts};'),
        ]

        games_per_query = max_games // len(queries)

        for query_name, base_query in queries:
            self.stdout.write(self.style.HTTP_INFO(f'\n{"="*60}'))
            self.stdout.write(self.style.HTTP_INFO(f'Query: {query_name} (target ~{games_per_query} games)'))
            self.stdout.write(self.style.HTTP_INFO(f'{"="*60}'))

            query_created = 0
            query_offset = 0

            while query_created < games_per_query and query_offset < 10000:
                query = f'{base_query} limit {batch_size}; offset {query_offset};'

                games_data = self._fetch_games(headers, query)
                if not games_data:
                    self.stdout.write(f'  No more games from "{query_name}" at offset {query_offset}')
                    break

                batch_created, batch_updated, batch_errors, batch_covers = self._save_games_batch(
                    games_data, skip_covers
                )

                total_created += batch_created
                total_updated += batch_updated
                total_errors += batch_errors
                total_covers += batch_covers
                query_created += batch_created

                self.stdout.write(
                    f'  [{query_name}] offset={query_offset}: '
                    f'+{batch_created} new, ~{batch_updated} updated, '
                    f'{batch_errors} errors, {batch_covers} covers'
                )

                query_offset += batch_size
                time.sleep(0.25)  # IGDB rate limit: 4 req/sec

                # If we got fewer results than batch_size, we've exhausted this query
                if len(games_data) < batch_size:
                    break

            self.stdout.write(self.style.SUCCESS(
                f'  {query_name} complete: {query_created} new games added'
            ))

        # Step 3: Deduplication
        self.stdout.write(self.style.HTTP_INFO(f'\n{"="*60}'))
        self.stdout.write(self.style.HTTP_INFO('Phase: Deduplication'))
        self.stdout.write(self.style.HTTP_INFO(f'{"="*60}'))
        self._deduplicate_games()

        # Final stats
        existing_after = Game.objects.count()
        self.stdout.write(self.style.SUCCESS(f'\n{"="*60}'))
        self.stdout.write(self.style.SUCCESS(f'IMPORT COMPLETE'))
        self.stdout.write(self.style.SUCCESS(f'{"="*60}'))
        self.stdout.write(f'  Games before: {existing_before}')
        self.stdout.write(f'  Games after:  {existing_after}')
        self.stdout.write(f'  Net new:      {existing_after - existing_before}')
        self.stdout.write(f'  Created:      {total_created}')
        self.stdout.write(f'  Updated:      {total_updated}')
        self.stdout.write(f'  Covers:       {total_covers}')
        self.stdout.write(f'  Errors:       {total_errors}')

    def _authenticate(self, client_id, client_secret):
        self.stdout.write('Authenticating with Twitch...')
        try:
            auth_response = requests.post(
                'https://id.twitch.tv/oauth2/token',
                params={
                    'client_id': client_id,
                    'client_secret': client_secret,
                    'grant_type': 'client_credentials'
                }
            )
            auth_response.raise_for_status()
            token = auth_response.json()['access_token']
            self.stdout.write(self.style.SUCCESS('Authentication successful!'))
            return token
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Authentication failed: {e}'))
            return None

    def _fetch_games(self, headers, query):
        try:
            response = requests.post(
                'https://api.igdb.com/v4/games',
                headers=headers,
                data=query,
                timeout=15
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'API error: {e}'))
            return []

    def _save_games_batch(self, games_data, skip_covers=False):
        created_count = 0
        updated_count = 0
        error_count = 0
        cover_count = 0

        for game_data in games_data:
            try:
                igdb_id = game_data.get('id')
                title = game_data.get('name')
                if not title or not igdb_id:
                    continue

                release_timestamp = game_data.get('first_release_date')
                release_date = None
                if release_timestamp:
                    try:
                        release_date = datetime.fromtimestamp(release_timestamp).date()
                    except (ValueError, OSError):
                        pass

                genres = [g['name'] for g in game_data.get('genres', []) if 'name' in g]

                # Try to find by igdb_id first
                game = Game.objects.filter(igdb_id=igdb_id).first()

                if game:
                    # Update existing
                    changed = False
                    if not game.genres and genres:
                        game.genres = genres
                        changed = True
                    if not game.release_date and release_date:
                        game.release_date = release_date
                        changed = True
                    if changed:
                        game.save()
                    updated_count += 1
                else:
                    # Check for title duplicate (from Steam imports without igdb_id)
                    existing_by_title = Game.objects.filter(title__iexact=title, igdb_id__isnull=True).first()
                    if existing_by_title:
                        # Merge: set igdb_id on existing record
                        existing_by_title.igdb_id = igdb_id
                        if not existing_by_title.genres and genres:
                            existing_by_title.genres = genres
                        if not existing_by_title.release_date and release_date:
                            existing_by_title.release_date = release_date
                        existing_by_title.save()
                        game = existing_by_title
                        updated_count += 1
                    else:
                        # Create new
                        game = Game.objects.create(
                            title=title,
                            igdb_id=igdb_id,
                            release_date=release_date,
                            genres=genres,
                        )
                        created_count += 1

                # Handle cover image
                if not skip_covers and not game.cover_image:
                    cover_data = game_data.get('cover')
                    if cover_data and 'url' in cover_data:
                        image_url = cover_data['url']
                        if image_url.startswith('//'):
                            image_url = f'https:{image_url}'
                        # Upgrade to high quality
                        image_url = image_url.replace('t_thumb', 't_cover_big')

                        try:
                            img_response = requests.get(image_url, timeout=8)
                            if img_response.status_code == 200 and len(img_response.content) > 500:
                                game.cover_image.save(
                                    f"igdb_{igdb_id}.jpg",
                                    ContentFile(img_response.content),
                                    save=True
                                )
                                cover_count += 1
                        except Exception:
                            pass

            except Exception as e:
                error_count += 1

        return created_count, updated_count, error_count, cover_count

    def _deduplicate_games(self):
        """Remove duplicate games, keeping the one with the most data."""
        from api.models import LibraryEntry

        self.stdout.write('\nFinding duplicates by title...')

        # Find titles that appear more than once
        dupes = (
            Game.objects.values('title')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
            .order_by('-count')
        )

        total_merged = 0

        for dupe in dupes:
            title = dupe['title']
            games = list(Game.objects.filter(title=title).order_by('id'))

            if len(games) <= 1:
                continue

            # Pick the "best" record to keep:
            # Priority: has igdb_id > has steam_appid > has cover_image > has genres > oldest
            def score(g):
                s = 0
                if g.igdb_id: s += 100
                if g.steam_appid: s += 50
                if g.cover_image: s += 25
                if g.genres: s += 10
                # Prefer the one with library entries
                entry_count = LibraryEntry.objects.filter(game=g).count()
                s += entry_count * 5
                return s

            games.sort(key=score, reverse=True)
            keeper = games[0]
            duplicates = games[1:]

            for dup in duplicates:
                # Migrate fields to keeper if keeper is missing them
                if not keeper.igdb_id and dup.igdb_id:
                    keeper.igdb_id = dup.igdb_id
                if not keeper.steam_appid and dup.steam_appid:
                    keeper.steam_appid = dup.steam_appid
                if not keeper.cover_image and dup.cover_image:
                    keeper.cover_image = dup.cover_image
                if not keeper.genres and dup.genres:
                    keeper.genres = dup.genres
                if not keeper.release_date and dup.release_date:
                    keeper.release_date = dup.release_date

                # Migrate library entries
                LibraryEntry.objects.filter(game=dup).exclude(
                    user__in=LibraryEntry.objects.filter(game=keeper).values('user')
                ).update(game=keeper)

                # Migrate reviews
                from core.models import Review
                Review.objects.filter(game=dup).exclude(
                    user__in=Review.objects.filter(game=keeper).values('user')
                ).update(game=keeper)

                # Delete duplicate
                dup.delete()
                total_merged += 1

            keeper.save()

        self.stdout.write(self.style.SUCCESS(f'Deduplication: merged {total_merged} duplicate games'))

        # Also do case-insensitive deduplication
        self.stdout.write('\nFinding case-insensitive duplicates...')
        from django.db.models.functions import Lower

        ci_dupes = (
            Game.objects.annotate(lower_title=Lower('title'))
            .values('lower_title')
            .annotate(count=Count('id'))
            .filter(count__gt=1)
            .order_by('-count')
        )

        ci_merged = 0
        for dupe in ci_dupes:
            lower_title = dupe['lower_title']
            games = list(Game.objects.annotate(lower_title=Lower('title')).filter(lower_title=lower_title).order_by('id'))

            if len(games) <= 1:
                continue

            def score(g):
                s = 0
                if g.igdb_id: s += 100
                if g.steam_appid: s += 50
                if g.cover_image: s += 25
                if g.genres: s += 10
                entry_count = LibraryEntry.objects.filter(game=g).count()
                s += entry_count * 5
                return s

            games.sort(key=score, reverse=True)
            keeper = games[0]
            duplicates = games[1:]

            for dup in duplicates:
                if not keeper.igdb_id and dup.igdb_id:
                    keeper.igdb_id = dup.igdb_id
                if not keeper.steam_appid and dup.steam_appid:
                    keeper.steam_appid = dup.steam_appid
                if not keeper.cover_image and dup.cover_image:
                    keeper.cover_image = dup.cover_image
                if not keeper.genres and dup.genres:
                    keeper.genres = dup.genres
                if not keeper.release_date and dup.release_date:
                    keeper.release_date = dup.release_date

                LibraryEntry.objects.filter(game=dup).exclude(
                    user__in=LibraryEntry.objects.filter(game=keeper).values('user')
                ).update(game=keeper)

                from core.models import Review
                Review.objects.filter(game=dup).exclude(
                    user__in=Review.objects.filter(game=keeper).values('user')
                ).update(game=keeper)

                dup.delete()
                ci_merged += 1

            keeper.save()

        self.stdout.write(self.style.SUCCESS(f'Case-insensitive dedup: merged {ci_merged} more duplicates'))
        self.stdout.write(self.style.SUCCESS(f'Total games after dedup: {Game.objects.count()}'))
