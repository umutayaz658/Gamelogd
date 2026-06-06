import os
import requests
import time
from core.models import Game
from django.conf import settings

# In a real app, these should come from settings or env properly. 
# Using the fallback ones from the import script for now.
IGDB_CLIENT_ID = os.environ.get('IGDB_CLIENT_ID') or 'elkye6v908qd8eb7sn10q9jy907j7w'
IGDB_CLIENT_SECRET = os.environ.get('IGDB_CLIENT_SECRET') or 'bgv30rr6kcqlic5ukc5sn795qnvzcz'

# Simple memory cache for the token to avoid re-authenticating every time
_ACCESS_TOKEN = None
_TOKEN_EXPIRY = 0

def get_igdb_token():
    global _ACCESS_TOKEN, _TOKEN_EXPIRY
    
    if _ACCESS_TOKEN and time.time() < _TOKEN_EXPIRY:
        return _ACCESS_TOKEN

    try:
        response = requests.post(
            'https://id.twitch.tv/oauth2/token',
            params={
                'client_id': IGDB_CLIENT_ID,
                'client_secret': IGDB_CLIENT_SECRET,
                'grant_type': 'client_credentials'
            },
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        _ACCESS_TOKEN = data['access_token']
        # typically valid for ~60 days, we'll cache it for a bit less just to be safe
        expires_in = data.get('expires_in', 3600) 
        _TOKEN_EXPIRY = time.time() + expires_in - 300 
        return _ACCESS_TOKEN
    except Exception as e:
        print(f"Failed to authenticate with IGDB: {e}")
        return None

def fetch_game_details(game: Game) -> Game:
    """
    Fetches missing details for a game from IGDB and saves them to the DB.
    Returns the updated game object.
    """
    if not game.igdb_id or game.details_fetched:
        return game

    token = get_igdb_token()
    if not token:
        return game # Failed to auth, just return what we have

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    # The query asks for summary, storyline, companies, platforms, screenshots, url
    query = f"""
        fields summary, storyline, url, cover.url,
               involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
               platforms.name, screenshots.url, genres.name;
        where id = {game.igdb_id};
    """

    try:
        response = requests.post(
            'https://api.igdb.com/v4/games',
            headers=headers,
            data=query,
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        if data:
            igdb_data = data[0]

            # Text fields
            game.summary = igdb_data.get('summary', '')
            game.description = igdb_data.get('storyline', '')
            game.igdb_url = igdb_data.get('url', '')

            # Cover
            if 'cover' in igdb_data and 'url' in igdb_data['cover'] and not game.cover_image:
                cover_url = igdb_data['cover']['url']
                if cover_url.startswith('//'):
                    cover_url = f"https:{cover_url}"
                game.cover_image = cover_url.replace('t_thumb', 't_cover_big')

            # Involved companies (developer & publisher)
            companies = igdb_data.get('involved_companies', [])
            developers = []
            publishers = []
            for c in companies:
                if 'company' in c and 'name' in c['company']:
                    name = c['company']['name']
                    if c.get('developer'):
                        developers.append(name)
                    if c.get('publisher'):
                        publishers.append(name)
            
            game.developer = ', '.join(developers)
            game.publisher = ', '.join(publishers)

            # Platforms
            platforms = igdb_data.get('platforms', [])
            game.platforms = [p['name'] for p in platforms if 'name' in p]

            # Screenshots
            screenshots = igdb_data.get('screenshots', [])
            screenshot_urls = []
            for s in screenshots:
                if 'url' in s:
                    url = s['url']
                    if url.startswith('//'):
                        url = f"https:{url}"
                    # Use 720p or 1080p images instead of thumbnails
                    # IGDB supports: t_720p, t_1080p, t_screenshot_huge
                    url = url.replace('t_thumb', 't_screenshot_huge')
                    screenshot_urls.append(url)
            
            game.screenshots = screenshot_urls

            # Update genres just in case they were missing
            genres = igdb_data.get('genres', [])
            if genres:
                game.genres = [g['name'] for g in genres if 'name' in g]

        # Mark as fetched even if data is empty so we don't keep trying
        game.details_fetched = True
        game.save()

    except Exception as e:
        print(f"Error fetching IGDB details for game {game.id}: {e}")

    return game
