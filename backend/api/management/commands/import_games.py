import os
import requests
import time
from datetime import datetime
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from core.models import Game

class Command(BaseCommand):
    help = 'Imports top games from IGDB API'

    def add_arguments(self, parser):
        parser.add_argument('--client-id', type=str, help='Twitch Client ID')
        parser.add_argument('--client-secret', type=str, help='Twitch Client Secret')
        parser.add_argument('--offset', type=int, default=0, help='Offset for pagination')

    def handle(self, *args, **options):
        # Configuration
        CLIENT_ID = options['client_id'] or os.environ.get('IGDB_CLIENT_ID') or 'elkye6v908qd8eb7sn10q9jy907j7w'
        CLIENT_SECRET = options['client_secret'] or os.environ.get('IGDB_CLIENT_SECRET') or 'bgv30rr6kcqlic5ukc5sn795qnvzcz'

        if not CLIENT_ID or not CLIENT_SECRET:
            self.stdout.write(self.style.ERROR('Client ID and Secret are required.'))
            return

        self.stdout.write('Authenticating with Twitch...')
        
        # Step 1: Authenticate
        auth_url = 'https://id.twitch.tv/oauth2/token'
        auth_params = {
            'client_id': CLIENT_ID,
            'client_secret': CLIENT_SECRET,
            'grant_type': 'client_credentials'
        }
        
        try:
            auth_response = requests.post(auth_url, params=auth_params)
            auth_response.raise_for_status()
            access_token = auth_response.json()['access_token']
            self.stdout.write(self.style.SUCCESS('Authentication successful!'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Authentication failed: {e}'))
            return

        # Step 2: Fetch Games
        self.stdout.write('Fetching games from IGDB...')
        url = 'https://api.igdb.com/v4/games'
        headers = {
            'Client-ID': CLIENT_ID,
            'Authorization': f'Bearer {access_token}'
        }
        
        # Query: Top 500 games by rating count, with cover and genres
        offset = options['offset']
        body = f'fields name, first_release_date, cover.url, summary, genres.name; sort rating_count desc; limit 500; offset {offset};'
        
        try:
            response = requests.post(url, headers=headers, data=body)
            response.raise_for_status()
            games_data = response.json()
            self.stdout.write(self.style.SUCCESS(f'Fetched {len(games_data)} games.'))
        except Exception as e:
            self.stdout.write(self.style.ERROR(f'Failed to fetch games: {e}'))
            return

        # Step 3: Save to Database
        self.stdout.write('Saving games to database...')
        
        for game_data in games_data:
            try:
                igdb_id = game_data.get('id')
                title = game_data.get('name')
                release_timestamp = game_data.get('first_release_date')
                
                release_date = None
                if release_timestamp:
                    release_date = datetime.fromtimestamp(release_timestamp).date()

                # Create or Update Game
                game, created = Game.objects.update_or_create(
                    igdb_id=igdb_id,
                    defaults={
                        'title': title,
                        'release_date': release_date,
                    }
                )

                # Handle Cover Image
                cover_data = game_data.get('cover')
                if cover_data and 'url' in cover_data:
                    image_url = cover_data['url']
                    if image_url.startswith('//'):
                        image_url = f'https:{image_url}'
                    
                    # Switch to high quality image
                    if 't_thumb' in image_url:
                        image_url = image_url.replace('t_thumb', 't_1080p')

                    # Download and save image
                    try:
                        img_response = requests.get(image_url)
                        if img_response.status_code == 200:
                            file_name = f"igdb_{igdb_id}.jpg"
                            game.cover_image.save(file_name, ContentFile(img_response.content), save=True)
                    except Exception as img_err:
                        self.stdout.write(self.style.WARNING(f'Failed to download image for {title}: {img_err}'))

                action = "Created" if created else "Updated"
                self.stdout.write(f'{action}: {title}')

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'Error saving game {game_data.get("name")}: {e}'))

        self.stdout.write(self.style.SUCCESS('Import process completed!'))
