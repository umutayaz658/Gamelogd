import requests
import time
from django.conf import settings
from django.core.files.base import ContentFile
from api.models import LibraryEntry, User
from core.models import Game


# Genre normalization map: non-English genre names → English
# Covers Russian, Turkish, and other common Steam locale variants
GENRE_TRANSLATION_MAP = {
    # Russian
    'Экшен': 'Action',
    'Экшн': 'Action',
    'Приключенческая игра': 'Adventure',
    'Приключения': 'Adventure',
    'Казуальные игры': 'Casual',
    'Казуальная игра': 'Casual',
    'Инди': 'Indie',
    'Ролевая игра': 'RPG',
    'РПГ': 'RPG',
    'Стратегия': 'Strategy',
    'Стратегии': 'Strategy',
    'Симулятор': 'Simulation',
    'Симуляторы': 'Simulation',
    'Симулятор жизни': 'Simulation',
    'Спорт': 'Sports',
    'Спортивные': 'Sports',
    'Гонки': 'Racing',
    'Гоночная игра': 'Racing',
    'Массовая многопользовательская': 'Massively Multiplayer',
    'Массовая многопользовательская игра': 'Massively Multiplayer',
    'ММО': 'Massively Multiplayer',
    'Бесплатная игра': 'Free to Play',
    'Бесплатная': 'Free to Play',
    'Ранний доступ': 'Early Access',
    'Анимация и моделирование': 'Animation & Modeling',
    'Дизайн и иллюстрация': 'Design & Illustration',
    'Обработка фото': 'Photo Editing',
    'Редактирование фото': 'Photo Editing',
    'Аудиопроизводство': 'Audio Production',
    'Видеопроизводство': 'Video Production',
    'Разработка игр': 'Game Development',
    'Разработка ПО': 'Software Training',
    'Образование': 'Education',
    'Утилиты': 'Utilities',
    'Веб-публикация': 'Web Publishing',
    'Многопользовательская': 'Multiplayer',
    'Головоломка': 'Puzzle',
    'Платформер': 'Platformer',
    'Шутер': 'Shooter',
    'Хоррор': 'Horror',
    'Выживание': 'Survival',
    'Песочница': 'Sandbox',
    'Открытый мир': 'Open World',
    'Пошаговая стратегия': 'Turn-Based Strategy',
    'Пошаговая стратегия (TBS)': 'Turn-Based Strategy',
    # Turkish
    'Aksiyon': 'Action',
    'Macera': 'Adventure',
    'Bağımsız Yapım': 'Indie',
    'Strateji': 'Strategy',
    'Simülasyon': 'Simulation',
    'Spor': 'Sports',
    'Yarış': 'Racing',
    'Rol Yapma': 'RPG',
}


def normalize_genre(genre_name):
    """
    Normalizes a genre name to English.
    If the genre is in the translation map, returns the English version.
    Otherwise returns the original name with proper title casing.
    """
    if not genre_name:
        return genre_name
    # Exact match first
    normalized = GENRE_TRANSLATION_MAP.get(genre_name)
    if normalized:
        return normalized
    # Case-insensitive match
    for key, value in GENRE_TRANSLATION_MAP.items():
        if key.lower() == genre_name.lower():
            return value
    return genre_name


def fetch_steam_genres(appid):
    """
    Fetches genre names for a game from the Steam Store API.
    Returns a list of genre name strings in English, e.g. ["Strategy", "Simulation"].
    """
    try:
        url = f"https://store.steampowered.com/api/appdetails?appids={appid}&l=english"
        # mature games (like Elden Ring) require age check cookies
        cookies = {'birthtime': '283993201', 'lastagecheckage': '1-January-1980', 'wants_mature_content': '1'}
        response = requests.get(url, cookies=cookies, timeout=10)
        response.raise_for_status()
        data = response.json()

        app_data = data.get(str(appid), {})
        if not app_data.get('success'):
            return []

        genres_raw = app_data.get('data', {}).get('genres', [])
        genres = [g['description'] for g in genres_raw if 'description' in g][:5]
        # Normalize all genre names to English (safety net)
        return [normalize_genre(g) for g in genres]
    except Exception as e:
        print(f"Failed to fetch genres for appid {appid}: {e}")
        return []


def fetch_steam_cover(appid):
    """
    Tries multiple Steam CDN URLs to find a working cover image.
    Returns (content_bytes, filename) or (None, None) if all fail.
    Fallback chain:
      1. library_600x900.jpg (portrait, ideal)
      2. library_600x900_2x.jpg (portrait, high-res)
      3. header.jpg (landscape, most reliable)
    """
    urls = [
        f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900.jpg",
        f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/library_600x900_2x.jpg",
        f"https://steamcdn-a.akamaihd.net/steam/apps/{appid}/header.jpg",
    ]
    
    for url in urls:
        try:
            resp = requests.get(url, timeout=8)
            if resp.status_code == 200 and len(resp.content) > 1000:
                # Check it's actually an image (not an error page)
                content_type = resp.headers.get('Content-Type', '')
                if 'image' in content_type or content_type == '':
                    return resp.content, f"{appid}.jpg"
        except Exception:
            continue
    
    return None, None


def fetch_steam_library(user_id, steam_id):
    """
    Fetches user's owned games from Steam and updates their LibraryEntry.
    Auto-creates games if they don't exist locally.
    Returns a dict with sync statistics.
    """
    stats = {
        'total': 0,
        'synced': 0,
        'created': 0,
        'cover_fixed': 0,
        'errors': 0,
        'error_details': []
    }
    
    # Fetch from settings
    api_key = settings.STEAM_API_KEY
    if not api_key:
        print("STEAM_API_KEY not found in environment settings.")
        return stats

    url = (
        f"http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/"
        f"?key={api_key}&steamid={steam_id}&format=json&include_appinfo=1"
        f"&include_played_free_games=1"
    )
    
    try:
        response = requests.get(url, timeout=15)
        
        if response.status_code == 403:
             print(f"Steam API 403 Forbidden. Check API Key or Profile Privacy for {steam_id}")
             raise Exception("Steam API Key invalid or Profile Private")

        response.raise_for_status()
        data = response.json()
        
        games = data.get('response', {}).get('games', [])
        stats['total'] = len(games)
        
        user = User.objects.get(id=user_id)
        
        for steam_game in games:
            try:
                title = steam_game.get('name')
                appid = steam_game.get('appid')
                playtime_forever = steam_game.get('playtime_forever', 0)  # In minutes
                
                if not title or not appid:
                    continue

                # 1. Try to find existing game by steam_appid first (most reliable)
                game = Game.objects.filter(steam_appid=appid).first()
                
                # 2. Fallback: try by exact title match
                if not game:
                    game = Game.objects.filter(title__iexact=title).first()
                    # If found by title, set the steam_appid for future reliable matching
                    if game and not game.steam_appid:
                        game.steam_appid = appid
                        game.save(update_fields=['steam_appid'])

                # 3. If still not found, create it
                if not game:
                    print(f"Creating new game from Steam: {title} (appid: {appid})")
                    # Fetch genres from Steam Store API
                    genres = fetch_steam_genres(appid)
                    time.sleep(0.3)  # Rate limit protection

                    game = Game.objects.create(
                        title=title,
                        steam_appid=appid,
                        igdb_id=None,
                        genres=genres,
                    )
                    stats['created'] += 1
                    
                    # Fetch Cover Image
                    cover_bytes, cover_filename = fetch_steam_cover(appid)
                    if cover_bytes:
                        game.cover_image.save(cover_filename, ContentFile(cover_bytes), save=True)
                    else:
                        print(f"No cover image found for {title} (appid: {appid})")
                else:
                    # Backfill genres if the existing game has none
                    needs_save = False
                    update_fields = []
                    
                    if not game.genres:
                        genres = fetch_steam_genres(appid)
                        if genres:
                            game.genres = genres
                            update_fields.append('genres')
                            needs_save = True
                            print(f"Backfilled genres for {title}: {genres}")
                        time.sleep(0.3)
                    
                    # Backfill steam_appid if missing
                    if not game.steam_appid:
                        game.steam_appid = appid
                        update_fields.append('steam_appid')
                        needs_save = True
                    
                    # Backfill cover image if missing
                    if not game.cover_image:
                        cover_bytes, cover_filename = fetch_steam_cover(appid)
                        if cover_bytes:
                            game.cover_image.save(cover_filename, ContentFile(cover_bytes), save=True)
                            stats['cover_fixed'] += 1
                            print(f"Backfilled cover for {title}")
                            needs_save = False  # save already happened via cover_image.save
                    
                    if needs_save and update_fields:
                        game.save(update_fields=update_fields)

                # 4. Determine Status
                new_status = 'unplayed'
                
                if playtime_forever == 0:
                    new_status = 'unplayed'
                else:
                    playtime_2weeks = steam_game.get('playtime_2weeks', 0)
                    rtime_last_played = steam_game.get('rtime_last_played', 0)
                    
                    current_timestamp = int(time.time())
                    two_weeks_ago = current_timestamp - (14 * 24 * 60 * 60)
                    
                    if playtime_2weeks > 0 or rtime_last_played > two_weeks_ago:
                        new_status = 'playing'
                    else:
                        new_status = 'dropped'

                # 5. Create or Update Library Entry
                existing_entry = LibraryEntry.objects.filter(user=user, game=game).first()
                
                final_status = new_status
                
                if existing_entry:
                    # PERSISTENCE RULE:
                    # Do NOT overwrite if user manually set to Completed, Replaying, or Dropped
                    if existing_entry.status in ['completed', 'replaying', 'dropped']:
                        final_status = existing_entry.status
                    elif existing_entry.status == 'unplayed' and new_status == 'playing':
                        final_status = 'playing'
                    elif existing_entry.status == 'playing' and new_status == 'dropped':
                        final_status = 'dropped'
                    elif existing_entry.status == 'unplayed' and new_status == 'dropped':
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
                stats['synced'] += 1
                
            except Exception as game_error:
                stats['errors'] += 1
                error_msg = f"Error syncing {steam_game.get('name', 'unknown')}: {game_error}"
                stats['error_details'].append(error_msg)
                print(error_msg)
                continue  # Don't let one game failure stop all others
            
    except Exception as e:
        print(f"Error fetching Steam library: {e}")
        raise  # Re-raise so the view knows sync failed
    
    print(f"Steam sync complete: {stats['synced']}/{stats['total']} games synced, "
          f"{stats['created']} created, {stats['cover_fixed']} covers fixed, "
          f"{stats['errors']} errors")
    
    return stats
