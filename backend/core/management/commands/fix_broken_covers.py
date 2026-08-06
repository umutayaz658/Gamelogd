import requests
from django.core.management.base import BaseCommand
from core.models import Game
from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID

class Command(BaseCommand):
    help = 'Fixes missing or broken game covers by re-fetching from IGDB'

    def handle(self, *args, **options):
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
                        response = requests.post(
                            'https://api.igdb.com/v4/games',
                            headers=headers,
                            data=query,
                            timeout=10
                        )

                        if response.status_code == 200:
                            data = response.json()
                            if data and len(data) > 0 and 'cover' in data[0] and 'image_id' in data[0]['cover']:
                                image_id = data[0]['cover']['image_id']
                                new_cover_url = f'https://images.igdb.com/igdb/image/upload/t_cover_big/{image_id}.jpg'
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
                        game.cover_image = get_steam_cover_url(game.steam_appid)
                        game.save(update_fields=['cover_image'])
                        self.stdout.write(self.style.SUCCESS(f'  -> Fell back to Steam CDN cover for {game.title}'))
                        fixed_count += 1
                    except Exception as e:
                        self.stdout.write(self.style.ERROR(f'  -> Steam fallback failed: {str(e)}'))

        self.stdout.write(self.style.SUCCESS(f'\nFinished checking {total_checked} games. Fixed {fixed_count} covers.'))
