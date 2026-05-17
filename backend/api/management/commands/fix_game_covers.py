"""
Management command to fix broken game cover images.
Replaces local file paths (games/20900.jpg) with Steam CDN URLs.

Usage: python manage.py fix_game_covers
"""
import requests
from django.core.management.base import BaseCommand
from core.models import Game


class Command(BaseCommand):
    help = 'Fix broken game cover images by replacing local paths with Steam CDN URLs'

    def handle(self, *args, **options):
        # Find all games with broken covers (local paths, not URLs)
        games = Game.objects.exclude(cover_image='').exclude(cover_image__isnull=True)
        
        fixed = 0
        already_ok = 0
        no_steam = 0
        
        for game in games:
            cover_value = str(game.cover_image)
            
            # Skip if already a URL (working)
            if cover_value.startswith('http'):
                already_ok += 1
                continue
            
            appid = game.steam_appid
            
            # If no steam_appid, try to extract from the filename (e.g., games/20900.jpg -> 20900)
            if not appid and 'games/' in cover_value:
                try:
                    filename = cover_value.split('/')[-1]
                    extracted_id = filename.split('.')[0]
                    if extracted_id.isdigit():
                        appid = extracted_id
                        # Update the database with the extracted steam_appid
                        game.steam_appid = appid
                except Exception:
                    pass
            
            if not appid:
                self.stdout.write(self.style.WARNING(f'  SKIP: {game.title} - no steam_appid'))
                no_steam += 1
                continue
            
            # Try to find working Steam CDN URL
            cover_url = self._get_best_cover_url(appid)
            game.cover_image = cover_url
            game.save(update_fields=['cover_image', 'steam_appid'])
            fixed += 1
            self.stdout.write(self.style.SUCCESS(f'  FIXED: {game.title} -> {cover_url}'))
        
        # Also fix games with no cover at all
        no_cover_games = Game.objects.filter(cover_image='') | Game.objects.filter(cover_image__isnull=True)
        for game in no_cover_games:
            if game.steam_appid:
                cover_url = self._get_best_cover_url(game.steam_appid)
                game.cover_image = cover_url
                game.save(update_fields=['cover_image'])
                fixed += 1
                self.stdout.write(self.style.SUCCESS(f'  ADDED: {game.title} -> {cover_url}'))
        
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Done! Fixed: {fixed}, Already OK: {already_ok}, Skipped (no Steam ID): {no_steam}'))

    def _get_best_cover_url(self, appid):
        """Returns the best available Steam CDN cover URL."""
        urls = [
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900.jpg",
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900_2x.jpg",
            f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/header.jpg",
        ]
        
        for url in urls:
            try:
                resp = requests.head(url, timeout=5)
                if resp.status_code == 200:
                    return url
            except Exception:
                continue
        
        return f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/header.jpg"
