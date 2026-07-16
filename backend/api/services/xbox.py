import requests
import time
import json
from django.conf import settings
from api.models import LibraryEntry
from core.models import Game
from core.utils import is_xbox_non_game, normalize_xbox_title, normalize_game_title


def fetch_xbox_games(xuid, xsts_token, user_hash):
    """
    Fetches the user's Xbox games via the Official Microsoft Xbox API (Titlehub).
    Returns a list of dicts with keys: name, raw_name, playtime, last_played.
    """
    headers = {
        'x-xbl-contract-version': '2',
        'Authorization': f'XBL3.0 x={user_hash};{xsts_token}',
        'Accept-Language': 'en-US'
    }

    try:
        url = f"https://titlehub.xboxlive.com/users/xuid({xuid})/titles/titlehistory/decoration/detail,stat"
        response = requests.get(url, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        titles = data.get('titles', [])
        
        # DEBUG: Log the first game's raw data to see where playtime is
        if titles:
            print("DEBUG FIRST GAME DATA:", json.dumps(titles[0], indent=2)[:1000])

        xbox_games = []
        for t in titles:
            # Only process actual games (filter out Apps)
            if t.get('type') != 'Game':
                continue
            
            raw_name = t.get('name', '')
            if not raw_name:
                continue
            
            # Filter non-game apps that Xbox marks as "Game" type
            if is_xbox_non_game(raw_name):
                print(f"  [SKIP] Non-game filtered: {raw_name}")
                continue
            
            title_history = t.get('titleHistory') or {}
            
            # Check stats from "stat" decoration
            stats = t.get('stats') or {}
            stat_playtime = stats.get('minutesPlayed', 0)
            
            # Fallback to titleHistory
            playtime = stat_playtime or title_history.get('minutesPlayed', 0)
            
            if not isinstance(playtime, (int, float)):
                try:
                    playtime = int(playtime)
                except (ValueError, TypeError):
                    playtime = 0

            # Normalize the title for matching
            cleaned_name = normalize_xbox_title(raw_name)
            if not cleaned_name:
                print(f"  [SKIP] Title normalized to empty: {raw_name}")
                continue

            xbox_games.append({
                'name': cleaned_name,
                'raw_name': raw_name,
                'playtime': playtime,
                'last_played': title_history.get('lastTimePlayed')
            })
        
        print(f"Xbox API returned {len(titles)} titles, {len(xbox_games)} games after filtering")
        return xbox_games

    except Exception as e:
        print(f"Error fetching Xbox games from official API: {e}")
        return []


def _search_igdb_for_game(title):
    """
    Searches IGDB for a game by title and returns (igdb_id, canonical_name) or (None, None).
    Prefers main games (category 0) over ports/remasters.
    """
    from api.services.igdb_service import get_igdb_token, IGDB_CLIENT_ID
    
    token = get_igdb_token()
    if not token:
        return None, None
    
    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }
    
    safe_title = title.replace('"', '').replace('\\', '')
    search_query = f'search "{safe_title}"; fields id, name, category, version_parent, parent_game; limit 10;'
    
    try:
        resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=search_query, timeout=10)
        if resp.status_code != 200 or not resp.json():
            return None, None
        
        results = resp.json()
        best_match = None
        
        # Priority 1: Exact name match on a main game (category 0 = main game)
        for g in results:
            cat = g.get('category', 0)
            if cat in (0, 8, 9, 10, 11) and not g.get('version_parent'):
                if g.get('name', '').lower() == title.lower():
                    best_match = g
                    break
        
        # Priority 2: Exact name match on any entry
        if not best_match:
            for g in results:
                if g.get('name', '').lower() == title.lower():
                    best_match = g
                    break
        
        # Priority 3: Case-insensitive contains match on main games
        if not best_match:
            title_lower = title.lower()
            for g in results:
                cat = g.get('category', 0)
                if cat in (0, 8, 9, 10, 11) and not g.get('version_parent'):
                    if title_lower in g.get('name', '').lower() or g.get('name', '').lower() in title_lower:
                        best_match = g
                        break
        
        # Priority 4: First result as fallback
        if not best_match:
            best_match = results[0]
        
        return best_match.get('id'), best_match.get('name')
    
    except Exception as e:
        print(f"  [IGDB] Search failed for '{title}': {e}")
        return None, None


def _find_or_create_game(cleaned_name, raw_name):
    """
    Smart game matching pipeline:
    1. Exact title match in DB (case-insensitive)
    2. Normalized title match in DB (strip trademarks from existing titles too)
    3. IGDB search -> if found, check if same igdb_id already exists in DB
    4. Create new Game as last resort
    
    Returns a Game object.
    """
    # Step 1: Direct DB match (case-insensitive)
    game = Game.objects.filter(title__iexact=cleaned_name).first()
    if game:
        print(f"  [MATCH] DB exact: '{raw_name}' -> '{game.title}'")
        return game
    
    # Step 2: Normalized match - compare normalized versions of all titles
    # This catches cases like "Call of Duty®" (DB) vs "Call of Duty" (cleaned)
    generic_normalized = normalize_game_title(cleaned_name)
    if generic_normalized != cleaned_name:
        game = Game.objects.filter(title__iexact=generic_normalized).first()
        if game:
            print(f"  [MATCH] DB normalized: '{raw_name}' -> '{game.title}'")
            return game
    
    # Also try matching by stripping trademarks from DB titles
    # This is a broader search but covers edge cases
    all_candidates = Game.objects.filter(title__icontains=cleaned_name[:10])  # Narrow initial set
    for candidate in all_candidates:
        candidate_normalized = normalize_game_title(candidate.title)
        if candidate_normalized.lower() == generic_normalized.lower():
            print(f"  [MATCH] DB normalized reverse: '{raw_name}' -> '{candidate.title}'")
            return candidate
    
    # Step 3: IGDB search
    igdb_id, igdb_name = _search_igdb_for_game(cleaned_name)
    
    if igdb_id:
        # Check if a Game with this igdb_id already exists (cross-platform dedup!)
        existing_game = Game.objects.filter(igdb_id=igdb_id).first()
        if existing_game:
            print(f"  [MATCH] IGDB dedup: '{raw_name}' -> '{existing_game.title}' (igdb_id={igdb_id})")
            return existing_game
        
        # No existing game with this igdb_id - create one with the IGDB canonical name
        from api.services.igdb_service import fetch_game_details
        canonical_name = igdb_name or cleaned_name
        game = Game.objects.create(
            title=canonical_name,
            igdb_id=igdb_id,
        )
        game = fetch_game_details(game)
        print(f"  [NEW] Created from IGDB: '{raw_name}' -> '{canonical_name}' (igdb_id={igdb_id})")
        return game
    
    # Step 4: No IGDB match - create with cleaned name
    from api.services.igdb_service import fetch_game_details
    game = Game.objects.create(title=cleaned_name)
    game = fetch_game_details(game)
    print(f"  [NEW] Created without IGDB: '{raw_name}' -> '{cleaned_name}'")
    return game


def sync_xbox_library(user, xuid, xsts_token, user_hash):
    """
    Syncs the user's Xbox library with smart deduplication.
    
    Pipeline:
    1. Fetch games from Xbox API
    2. Filter non-game apps (launchers, media, Microsoft built-ins)
    3. Normalize titles (strip platform tags, editions, trademarks)
    4. Match against existing DB games (exact -> normalized -> IGDB)
    5. Cross-platform dedup via igdb_id
    6. Create/update LibraryEntry with combined playtime
    """
    if not user.xbox_gamertag:
        return
    
    print(f"\n{'='*60}")
    print(f"Starting Xbox sync for {user.username} ({user.xbox_gamertag})")
    print(f"{'='*60}")
    
    xbox_games = fetch_xbox_games(xuid, xsts_token, user_hash)
    
    stats = {
        'total': len(xbox_games),
        'matched': 0,
        'created': 0,
        'skipped': 0,
        'errors': 0,
    }
    
    for x_game in xbox_games:
        try:
            cleaned_name = x_game['name']
            raw_name = x_game['raw_name']
            playtime = x_game.get('playtime', 0)
            
            # Find or create the Game object using smart matching
            game = _find_or_create_game(cleaned_name, raw_name)
            
            # Create or update library entry
            entry, created = LibraryEntry.objects.get_or_create(
                user=user,
                game=game,
                defaults={
                    'status': 'played',
                    'platform': 'Xbox',
                    'xbox_playtime': playtime,
                    'playtime_forever': playtime,
                }
            )
            
            if not created:
                # Update Xbox playtime and recalculate total
                entry.xbox_playtime = playtime
                entry.playtime_forever = entry.steam_playtime + entry.xbox_playtime
                
                # Ensure platform contains Xbox
                if not entry.platform:
                    entry.platform = 'Xbox'
                elif 'Xbox' not in entry.platform:
                    entry.platform += ', Xbox'
                
                # Don't override user-set statuses
                if entry.status not in ['completed', 'replaying', 'dropped', 'playing']:
                    entry.status = 'played'
                
                entry.save()
                stats['matched'] += 1
            else:
                stats['created'] += 1
            
            # Rate limit IGDB calls
            time.sleep(0.25)
            
        except Exception as e:
            stats['errors'] += 1
            print(f"  [ERROR] Failed to sync '{x_game.get('raw_name', '?')}': {e}")
            continue
    
    print(f"\n{'='*60}")
    print(f"Xbox sync complete for {user.username}:")
    print(f"  Total: {stats['total']}, Matched: {stats['matched']}, "
          f"Created: {stats['created']}, Errors: {stats['errors']}")
    print(f"{'='*60}\n")
    
    return stats
