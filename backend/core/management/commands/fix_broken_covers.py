import time
import requests
from django.core.management.base import BaseCommand
from core.models import Game
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

class Command(BaseCommand):
    help = 'Fixes missing or broken game covers by re-fetching from IGDB'

    # Known-bad steam_appid -> correct appid mappings, found while investigating broken
    # covers. 3558670 is "Tomb Raider: Legacy of Atlantis" on Steam, an unrelated title — our
    # "Tomb Raider" (2013) row got mismatched to it at some point (likely a sync/matching
    # bug). Fixed here directly since a wrong appid also breaks future Steam-library-sync
    # matching for this game, beyond just its cover.
    KNOWN_BAD_APPIDS = {
        'Tomb Raider': (3558670, 203160),
    }

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Report what would change without saving')

    def _fix_known_bad_appids(self, dry_run):
        for title, (bad_appid, correct_appid) in self.KNOWN_BAD_APPIDS.items():
            game = Game.objects.filter(title=title, steam_appid=bad_appid).first()
            if not game:
                continue
            if Game.objects.filter(steam_appid=correct_appid).exclude(id=game.id).exists():
                self.stdout.write(self.style.ERROR(
                    f'  SKIP appid fix for "{title}": {correct_appid} is already used by another game'
                ))
                continue
            self.stdout.write(f'  APPID FIX: "{title}" steam_appid {bad_appid} -> {correct_appid}')
            if not dry_run:
                game.steam_appid = correct_appid
                game.save(update_fields=['steam_appid'])

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        self._fix_known_bad_appids(dry_run)

        games = Game.objects.all()
        fixed_count = 0
        total_checked = 0

        # Don't abort the whole run if IGDB is unreachable/unconfigured (e.g. no IGDB_CLIENT_ID
        # set in a local dev environment) — games with a steam_appid can still be repaired via
        # the Steam CDN fallback below without ever needing IGDB.
        token = get_igdb_token()
        if not token:
            self.stdout.write(self.style.WARNING(
                'Failed to get IGDB token (missing/invalid IGDB credentials?) — continuing '
                'without IGDB. Only games with a steam_appid can be fixed this run.'
            ))

        headers = {
            'Client-ID': IGDB_CLIENT_ID,
            'Authorization': f'Bearer {token}',
            'Accept': 'application/json'
        } if token else None

        for game in games:
            total_checked += 1
            needs_fix = False
            
            # Check if cover is missing
            if not game.cover_image or not str(game.cover_image).strip():
                needs_fix = True
            else:
                cover_url = str(game.cover_image)
                if cover_url.startswith('http'):
                    # Check if the URL is broken (only meaningful for real http/https URLs)
                    try:
                        # Use GET instead of HEAD as some CDNs might block HEAD or return different status
                        # Timeout 5s, only fetch headers essentially by using stream=True and reading nothing
                        resp = requests.get(cover_url, stream=True, timeout=5)
                        if resp.status_code == 404:
                            needs_fix = True
                        resp.close()
                    except requests.RequestException:
                        # If request fails completely, we might want to try fixing it
                        needs_fix = True
                else:
                    # A storage-relative path (e.g. "games/570.jpg") — left over from older
                    # import commands that downloaded covers through Django's storage backend
                    # (ImageField.save(..., ContentFile(...))) instead of just storing a CDN
                    # URL string like current Steam/Xbox sync does. This resolves completely
                    # differently per environment (FileSystemStorage locally vs Cloudinary in
                    # production), so a value that "works" in whichever environment happened to
                    # download the file is broken everywhere else — always needs re-deriving as
                    # a real external URL.
                    needs_fix = True

            if needs_fix:
                self.stdout.write(f'Fixing cover for game: {game.title} (ID: {game.id})')
                fixed_this_game = False

                if headers:
                    query = ''
                    if game.igdb_id:
                        query = f'fields cover.image_id; where id = {game.igdb_id};'
                    else:
                        safe_title = game.title.replace('"', '\\"')
                        query = f'fields cover.image_id; search "{safe_title}"; limit 1;'

                    try:
                        # IGDB rate-limits at ~4 req/s; firing one request per broken game with
                        # no pacing trips it hard on any DB with more than a handful of broken
                        # covers (seen locally: hundreds of consecutive 429s). Retry with a
                        # short backoff instead of just giving up on the first 429.
                        response = None
                        for attempt in range(3):
                            response = requests.post(
                                'https://api.igdb.com/v4/games',
                                headers=headers,
                                data=query,
                                timeout=10
                            )
                            if response.status_code != 429:
                                break
                            time.sleep(1.5 * (attempt + 1))
                        time.sleep(0.25)

                        if response.status_code == 200:
                            data = response.json()
                            if data and len(data) > 0 and 'cover' in data[0] and 'image_id' in data[0]['cover']:
                                image_id = data[0]['cover']['image_id']
                                new_cover_url = f'https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg'
                                if dry_run:
                                    self.stdout.write(f'  -> Would update cover for {game.title} -> {new_cover_url}')
                                else:
                                    game.cover_image = new_cover_url
                                    game.save(update_fields=['cover_image'])
                                    self.stdout.write(self.style.SUCCESS(f'  -> Successfully updated cover for {game.title}'))
                                fixed_count += 1
                                fixed_this_game = True
                            else:
                                self.stdout.write(self.style.WARNING(f'  -> No cover found on IGDB for {game.title}'))
                        else:
                            self.stdout.write(self.style.ERROR(f'  -> IGDB API error: {response.status_code}'))
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  -> Exception: {str(e)}'))

                # IGDB had nothing (or errored) — for games with a Steam appid, fall back to a
                # fresh Steam CDN URL rather than leaving a relative/broken value in place.
                if not fixed_this_game and game.steam_appid:
                    try:
                        from api.services.steam import get_steam_cover_url
                        steam_url = get_steam_cover_url(game.steam_appid)
                        if dry_run:
                            self.stdout.write(f'  -> Would fall back to Steam CDN cover for {game.title} -> {steam_url}')
                        else:
                            game.cover_image = steam_url
                            game.save(update_fields=['cover_image'])
                            self.stdout.write(self.style.SUCCESS(f'  -> Fell back to Steam CDN cover for {game.title}'))
                        fixed_count += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  -> Steam fallback failed: {str(e)}'))

        prefix = 'Would fix' if dry_run else 'Fixed'
        self.stdout.write(self.style.SUCCESS(f'\nFinished checking {total_checked} games. {prefix} {fixed_count} covers.'))
