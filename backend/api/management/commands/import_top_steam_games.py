import time
import requests
from django.core.management.base import BaseCommand
from core.models import Game
from api.services.steam import fetch_steam_genres

class Command(BaseCommand):
    help = 'Fetches top games from SteamSpy and adds them to the database'

    def add_arguments(self, parser):
        parser.add_argument('--limit', type=int, default=100, help='Number of top games to fetch')

    def handle(self, *args, **options):
        limit = options['limit']
        
        self.stdout.write(f"Fetching top {limit} games from SteamSpy (Top 100 in 2 weeks)")
        
        try:
            # SteamSpy API to get top games in the last 2 weeks
            response = requests.get('https://steamspy.com/api.php?request=top100in2weeks')
            
            if response.status_code != 200:
                self.stdout.write(self.style.ERROR(f"SteamSpy API returned status {response.status_code}"))
                return
                
            data = response.json()
            games_added = 0
            games_existed = 0
            
            # data is a dict keyed by appid (as string)
            appids = list(data.keys())[:limit]
            
            for index, appid_str in enumerate(appids):
                appid = int(appid_str)
                game_data = data[appid_str]
                title = game_data.get('name', '')
                
                # Check if we already have a game with this title
                if Game.objects.filter(title__iexact=title).exists():
                    games_existed += 1
                    continue
                    
                # We need genres. Let's fetch them using our existing service
                time.sleep(1) # Be nice to Steam API
                genres = fetch_steam_genres(appid)
                
                # We also need a cover image. We'll use the standard Steam capsule URL
                cover_url = f"https://cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg"
                
                # Let's try downloading the image just to make sure it exists, 
                # but we can also just save the URL since the frontend models support URLs.
                # Actually, our imagefield might require downloading or save it as a direct URL string.
                # Since the db allows chars in the ImageField up to 255 if it's treated loosely, 
                # or we can download it. Let's just save the url text manually which django might allow or we can download.
                
                from django.core.files.base import ContentFile
                try:
                    img_response = requests.get(cover_url, timeout=5)
                    if img_response.status_code == 200:
                        image_file = ContentFile(img_response.content, name=f"{appid}.jpg")
                    else:
                        image_file = None
                except Exception:
                    image_file = None

                game = Game(
                    title=title,
                    release_date=None,  # We don't have easy access to precise dates in this basic call
                    genres=genres or []
                )
                
                if image_file:
                    game.cover_image.save(f"{appid}.jpg", image_file, save=False)
                    
                game.save()
                games_added += 1
                
                self.stdout.write(self.style.SUCCESS(f"[{index + 1}/{len(appids)}] Added {title} (Genres: {genres})"))
                
            self.stdout.write(self.style.SUCCESS(f"\nFinished! Added {games_added} new games. {games_existed} already existed."))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"Error fetching from SteamSpy: {str(e)}"))
