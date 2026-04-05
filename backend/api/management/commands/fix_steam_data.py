import requests
import time
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from core.models import Game


class Command(BaseCommand):
    help = 'Backfills steam_appid and missing cover images for existing games using Steam search API'

    def add_arguments(self, parser):
        parser.add_argument('--covers-only', action='store_true', help='Only fix missing cover images')
        parser.add_argument('--dry-run', action='store_true', help='Show what would be done without making changes')

    def handle(self, *args, **options):
        covers_only = options.get('covers_only', False)
        dry_run = options.get('dry_run', False)

        if not covers_only:
            self._backfill_steam_appids(dry_run)
        
        self._fix_missing_covers(dry_run)
        
        self.stdout.write(self.style.SUCCESS('Backfill complete!'))

    def _search_steam_appid(self, title):
        """Search the Steam Store for a game by title, return appid if found."""
        try:
            url = f"https://store.steampowered.com/api/storesearch/?term={requests.utils.quote(title)}&l=english&cc=US"
            resp = requests.get(url, timeout=10)
            resp.raise_for_status()
            data = resp.json()
            
            items = data.get('items', [])
            if not items:
                return None
            
            # Try exact match first
            for item in items:
                if item.get('name', '').lower() == title.lower():
                    return item.get('id')
            
            # Fallback to first result
            return items[0].get('id')
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'  Search failed for "{title}": {e}'))
            return None

    def _fetch_cover(self, appid):
        """Try multiple Steam CDN URLs for cover image."""
        urls = [
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900.jpg",
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900_2x.jpg",
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/header.jpg",
        ]
        
        for url in urls:
            try:
                resp = requests.get(url, timeout=8)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    content_type = resp.headers.get('Content-Type', '')
                    if 'image' in content_type or content_type == '':
                        return resp.content
            except Exception:
                continue
        return None

    def _backfill_steam_appids(self, dry_run):
        """Find Steam AppIDs for games that don't have one."""
        games_without_appid = Game.objects.filter(steam_appid__isnull=True)
        total = games_without_appid.count()
        
        self.stdout.write(f'\nBackfilling Steam AppIDs for {total} games...')
        
        fixed = 0
        for i, game in enumerate(games_without_appid.iterator()):
            appid = self._search_steam_appid(game.title)
            if appid:
                # Check for conflicts
                if Game.objects.filter(steam_appid=appid).exists():
                    self.stdout.write(f'  [{i+1}/{total}] SKIP "{game.title}" - appid {appid} already used by another game')
                    continue
                    
                if dry_run:
                    self.stdout.write(f'  [{i+1}/{total}] WOULD SET "{game.title}" -> appid {appid}')
                else:
                    game.steam_appid = appid
                    game.save(update_fields=['steam_appid'])
                    self.stdout.write(f'  [{i+1}/{total}] SET "{game.title}" -> appid {appid}')
                fixed += 1
            else:
                self.stdout.write(f'  [{i+1}/{total}] NOT FOUND on Steam: "{game.title}"')
            
            time.sleep(0.3)  # Rate limit
        
        self.stdout.write(self.style.SUCCESS(f'AppID backfill: {fixed}/{total} games updated'))

    def _fix_missing_covers(self, dry_run):
        """Download cover images for games that have a steam_appid but no cover."""
        games_no_cover = Game.objects.filter(
            steam_appid__isnull=False,
        ).exclude(
            cover_image__isnull=False
        ).exclude(cover_image='')
        
        # Also include games where cover_image field exists but is empty string
        games_no_cover_2 = Game.objects.filter(
            steam_appid__isnull=False,
            cover_image=''
        )
        
        # Combine both querysets
        from django.db.models import Q
        games = Game.objects.filter(
            steam_appid__isnull=False
        ).filter(
            Q(cover_image__isnull=True) | Q(cover_image='')
        )
        
        total = games.count()
        self.stdout.write(f'\nFixing missing covers for {total} games...')
        
        fixed = 0
        for i, game in enumerate(games.iterator()):
            cover_bytes = self._fetch_cover(game.steam_appid)
            if cover_bytes:
                if dry_run:
                    self.stdout.write(f'  [{i+1}/{total}] WOULD FIX cover for "{game.title}"')
                else:
                    game.cover_image.save(f"{game.steam_appid}.jpg", ContentFile(cover_bytes), save=True)
                    self.stdout.write(f'  [{i+1}/{total}] FIXED cover for "{game.title}"')
                fixed += 1
            else:
                self.stdout.write(f'  [{i+1}/{total}] No cover found for "{game.title}" (appid: {game.steam_appid})')
            
            time.sleep(0.2)
        
        self.stdout.write(self.style.SUCCESS(f'Cover fix: {fixed}/{total} covers downloaded'))
