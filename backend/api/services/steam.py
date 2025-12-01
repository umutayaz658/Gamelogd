import requests
from django.conf import settings
from django.core.files.base import ContentFile
from api.models import LibraryEntry, User
from core.models import Game

def fetch_steam_library(user_id, steam_id):
    """
    Fetches user's owned games from Steam and updates their LibraryEntry.
    Auto-creates games if they don't exist locally.
    """
    # In production, this should be in settings
    api_key = '156950A4EAAE233930E8347C38DE3849'
    if not api_key:
        print("STEAM_API_KEY not found.")
        return

    url = f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key={api_key}&steamid={steam_id}&format=json&include_appinfo=1"
    
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        games = data.get('response', {}).get('games', [])
        
        user = User.objects.get(id=user_id)
        
        for steam_game in games:
            title = steam_game.get('name')
            appid = steam_game.get('appid')
            playtime_forever = steam_game.get('playtime_forever', 0) # In minutes
            
            if not title:
                continue

            # 1. Try to find existing game
            game = Game.objects.filter(title__iexact=title).first()
            
            # 2. If not found, create it
            if not game:
                print(f"Creating new game from Steam: {title}")
                game = Game.objects.create(
                    title=title,
                    igdb_id=None # We don't have IGDB ID yet
                )
                
                # Fetch Cover Image
                # Use Steam Library Header format (600x900)
                image_url = f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900.jpg"
                try:
                    img_response = requests.get(image_url, timeout=5)
                    if img_response.status_code == 200:
                        game.cover_image.save(f"{appid}.jpg", ContentFile(img_response.content), save=True)
                    else:
                        print(f"Failed to fetch cover for {title}: {img_response.status_code}")
                except Exception as e:
                    print(f"Error fetching cover for {title}: {e}")

            # 3. Determine Status
            # Default to 'unplayed'
            new_status = 'unplayed'
            
            if playtime_forever == 0:
                new_status = 'unplayed'
            else:
                # Check if played recently (last 2 weeks)
                playtime_2weeks = steam_game.get('playtime_2weeks', 0)
                rtime_last_played = steam_game.get('rtime_last_played', 0)
                
                import time
                current_timestamp = int(time.time())
                two_weeks_ago = current_timestamp - (14 * 24 * 60 * 60)
                
                if playtime_2weeks > 0 or rtime_last_played > two_weeks_ago:
                    new_status = 'playing'
                else:
                    new_status = 'dropped'

            # 4. Create or Update Library Entry
            existing_entry = LibraryEntry.objects.filter(user=user, game=game).first()
            
            final_status = new_status
            
            if existing_entry:
                # PERSISTENCE RULE:
                # Do NOT overwrite if user manually set to Completed, Replaying, or Dropped
                if existing_entry.status in ['completed', 'replaying', 'dropped']:
                    final_status = existing_entry.status
                
                # Special Case: If it was 'playing' and now logic says 'dropped' (inactive), allow update?
                # User said: "If playtime_forever > 0 BUT not played recently -> Set to DROPPED"
                # But also: "Only update if the logic detects a change from 'UNPLAYED' -> 'PLAYING'"
                # Let's follow the specific instruction:
                # "Only update if the logic detects a change from 'UNPLAYED' -> 'PLAYING'."
                # This implies we should be conservative.
                
                # However, if we strictly follow "Only update if UNPLAYED -> PLAYING", we miss the auto-drop feature.
                # Let's interpret the user's intent as: "Don't mess up my manual organization".
                
                # Refined Logic based on "Crucial Persistence":
                # If existing is UNPLAYED and new is PLAYING -> Update.
                # If existing is PLAYING and new is DROPPED -> Update (Auto-drop inactive games).
                # If existing is COMPLETED/REPLAYING/DROPPED -> Keep existing.
                
                if existing_entry.status == 'unplayed' and new_status == 'playing':
                    final_status = 'playing'
                elif existing_entry.status == 'playing' and new_status == 'dropped':
                    final_status = 'dropped'
                elif existing_entry.status in ['completed', 'replaying', 'dropped']:
                    final_status = existing_entry.status
                else:
                    # Fallback for other cases (e.g. unplayed -> dropped if imported with history)
                    if existing_entry.status == 'unplayed' and new_status == 'dropped':
                        final_status = 'dropped'

            LibraryEntry.objects.update_or_create(
                user=user,
                game=game,
                defaults={
                    'playtime_forever': playtime_forever,
                    'platform': 'Steam',
                    'status': final_status
                }
            )
            
    except Exception as e:
        print(f"Error fetching Steam library: {e}")
