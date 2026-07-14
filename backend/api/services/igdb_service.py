import os
import requests
import time
from core.models import Game
from django.conf import settings
from django.core.cache import cache
from core.utils import is_unwanted_game
from api.services.hltb_service import fetch_hltb_times

# Credentials come only from the environment. Never hard-code the Twitch/IGDB
# client_secret here — a committed secret must be treated as compromised and rotated.
IGDB_CLIENT_ID = os.environ.get('IGDB_CLIENT_ID')
IGDB_CLIENT_SECRET = os.environ.get('IGDB_CLIENT_SECRET')

# Simple memory cache for the token to avoid re-authenticating every time
_ACCESS_TOKEN = None
_TOKEN_EXPIRY = 0


def _sanitize_apicalypse(value: str) -> str:
    """Strip characters that could break out of a quoted apicalypse string literal.

    Company/game names flow into IGDB `where name ~ *"..."*` clauses; removing quotes and
    backslashes keeps user-supplied input from altering the query structure.
    """
    if not value:
        return ''
    return str(value).replace('"', '').replace('\\', '')

def get_igdb_token():
    global _ACCESS_TOKEN, _TOKEN_EXPIRY

    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET:
        return None

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
    if game.details_fetched:
        return game

    if not IGDB_CLIENT_ID or not IGDB_CLIENT_SECRET:
        print(f"IGDB credentials not configured. Skipping detail fetch for game {game.id} ({game.title})")
        return game

    token = get_igdb_token()
    if not token:
        print(f"Failed to get IGDB token. Skipping detail fetch for game {game.id} ({game.title})")
        return game # Failed to auth, just return what we have

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    target_igdb_id = game.igdb_id

    # Resolve IGDB ID if missing (e.g. for games synced from Steam)
    if not target_igdb_id:
        try:
            # Sanitize title for IGDB search
            safe_title = game.title.replace('"', '').replace('\\', '')
            search_query = f'search "{safe_title}"; fields id, name, category, version_parent, parent_game; limit 10;'
            resp = requests.post('https://api.igdb.com/v4/games', headers=headers, data=search_query, timeout=10)
            if resp.status_code == 200 and resp.json():
                results = resp.json()
                best_match = None
                
                # Look for exact match and main game
                for g in results:
                    cat = g.get('category', 0)
                    if cat in (0, 8, 9, 10, 11) and not g.get('version_parent'):
                        if g.get('name', '').lower() == game.title.lower():
                            best_match = g
                            break
                            
                # Fallback to first result if no exact main game match
                if not best_match:
                    best_match = results[0]
                    
                target_igdb_id = best_match['id']
                
                # Safely save igdb_id only if it's not already taken by a duplicate game
                if not Game.objects.filter(igdb_id=target_igdb_id).exclude(id=game.id).exists():
                    game.igdb_id = target_igdb_id
                    game.save(update_fields=['igdb_id'])
            else:
                # Could not find game on IGDB
                game.details_fetched = True
                game.save()
                return game
        except Exception as e:
            print(f"Failed to resolve IGDB ID for {game.title}: {e}")
            return game
    # The query asks for summary, storyline, companies, platforms, screenshots, url, and aggregated_rating
    query = f"""
        fields summary, storyline, url, cover.url, first_release_date, aggregated_rating,
               involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
               platforms.name, screenshots.url, genres.name;
        where id = {target_igdb_id};
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

            # Release date
            if 'first_release_date' in igdb_data and not game.release_date:
                import datetime
                try:
                    game.release_date = datetime.datetime.fromtimestamp(igdb_data['first_release_date']).strftime('%Y-%m-%d')
                except Exception as e:
                    print(f"Failed to parse release date: {e}")

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

            # Metacritic Score (aggregated_rating)
            if 'aggregated_rating' in igdb_data:
                game.metacritic_score = int(round(igdb_data['aggregated_rating']))

            # HowLongToBeat
            hltb_data = fetch_hltb_times(game.title)
            game.hltb_main = hltb_data.get('hltb_main')
            game.hltb_main_extra = hltb_data.get('hltb_main_extra')
            game.hltb_completionist = hltb_data.get('hltb_completionist')

            # Update genres just in case they were missing
            genres = igdb_data.get('genres', [])
            if genres:
                game.genres = [g['name'] for g in genres if 'name' in g]

            print(f"IGDB details fetched for game {game.id} ({game.title}): "
                  f"summary={bool(game.summary)}, screenshots={len(screenshot_urls)}, "
                  f"developer={game.developer or 'N/A'}")
        else:
            print(f"IGDB returned empty data for game {game.id} (igdb_id={game.igdb_id})")

        # Mark as fetched even if data is empty so we don't keep trying
        game.details_fetched = True
        game.save()

    except requests.exceptions.Timeout:
        print(f"IGDB request timed out for game {game.id} ({game.title}, igdb_id={game.igdb_id})")
    except requests.exceptions.HTTPError as e:
        print(f"IGDB HTTP error for game {game.id} ({game.title}): {e.response.status_code} {e.response.text[:200]}")
    except Exception as e:
        print(f"Error fetching IGDB details for game {game.id} ({game.title}): {e}")

    return game


# ── Subsidiary → Parent Company Mapping ──────────────────────────────
SUBSIDIARY_MAP = {
    # Rockstar
    'rockstar north': 'Rockstar Games',
    'rockstar san diego': 'Rockstar Games',
    'rockstar leeds': 'Rockstar Games',
    'rockstar toronto': 'Rockstar Games',
    'rockstar new england': 'Rockstar Games',
    'rockstar lincoln': 'Rockstar Games',
    'rockstar india': 'Rockstar Games',
    'rockstar dundee': 'Rockstar Games',
    # Activision / Call of Duty
    'infinity ward': 'Activision',
    'treyarch': 'Activision',
    'sledgehammer games': 'Activision',
    'raven software': 'Activision',
    # Xbox Game Studios / Microsoft
    '343 industries': 'Xbox Game Studios',
    'the coalition': 'Xbox Game Studios',
    'turn 10 studios': 'Xbox Game Studios',
    'playground games': 'Xbox Game Studios',
    'obsidian entertainment': 'Xbox Game Studios',
    'ninja theory': 'Xbox Game Studios',
    'rare ltd.': 'Xbox Game Studios',
    'rare': 'Xbox Game Studios',
    'double fine productions': 'Xbox Game Studios',
    # PlayStation Studios / Sony
    'naughty dog': 'Sony Interactive Entertainment',
    'insomniac games': 'Sony Interactive Entertainment',
    'guerrilla games': 'Sony Interactive Entertainment',
    'sucker punch productions': 'Sony Interactive Entertainment',
    'santa monica studio': 'Sony Interactive Entertainment',
    'polyphony digital': 'Sony Interactive Entertainment',
    'bend studio': 'Sony Interactive Entertainment',
    'bluepoint games': 'Sony Interactive Entertainment',
    'housemarque': 'Sony Interactive Entertainment',
    'firesprite': 'Sony Interactive Entertainment',
    'playstation studios': 'Sony Interactive Entertainment',
    # EA
    'dice': 'Electronic Arts',
    'ea dice': 'Electronic Arts',
    'bioware': 'Electronic Arts',
    'respawn entertainment': 'Electronic Arts',
    'criterion games': 'Electronic Arts',
    'ea sports': 'Electronic Arts',
    'maxis': 'Electronic Arts',
    'ea vancouver': 'Electronic Arts',
    # Ubisoft
    'ubisoft montreal': 'Ubisoft',
    'ubisoft quebec': 'Ubisoft',
    'ubisoft toronto': 'Ubisoft',
    'ubisoft paris': 'Ubisoft',
    'ubisoft milan': 'Ubisoft',
    'ubisoft bucharest': 'Ubisoft',
    'ubisoft sofia': 'Ubisoft',
    'massive entertainment': 'Ubisoft',
    # Square Enix
    'square enix business division 1': 'Square Enix',
    'square enix business division 2': 'Square Enix',
    'square enix creative business unit i': 'Square Enix',
    'square enix creative business unit iii': 'Square Enix',
    'luminous productions': 'Square Enix',
    # Nintendo
    'nintendo epd': 'Nintendo',
    'nintendo ead': 'Nintendo',
    'retro studios': 'Nintendo',
    'monolith soft': 'Nintendo',
    'intelligent systems': 'Nintendo',
    # Other
    'cd projekt red': 'CD Projekt',
    'io interactive a/s': 'IO Interactive',
}


def resolve_company_name(name: str) -> str:
    """Resolve subsidiary studio name to parent company name."""
    if not name:
        return name
    return SUBSIDIARY_MAP.get(name.strip().lower(), name.strip())


def resolve_top_parent_dynamically(company_name: str, token: str) -> tuple[str, str | None]:
    """Resolve subsidiary studio name to topmost parent dynamically using IGDB."""
    company_name = _sanitize_apicalypse(company_name)
    # First check static map
    mapped = resolve_company_name(company_name)
    if mapped.lower() != company_name.lower():
        return mapped, company_name

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }
    
    query = f"""
        where name ~ *"{company_name}"*;
        fields name, parent.name, parent.parent.name, parent.parent.parent.name;
        limit 1;
    """
    
    try:
        resp = requests.post('https://api.igdb.com/v4/companies', headers=headers, data=query, timeout=10)
        resp.raise_for_status()
        companies = resp.json()
        
        if companies:
            c = companies[0]
            parent = c.get('parent')
            if parent:
                top_name = parent.get('name')
                p2 = parent.get('parent')
                if p2:
                    top_name = p2.get('name')
                    p3 = p2.get('parent')
                    if p3:
                        top_name = p3.get('name')
                
                if top_name and top_name.lower() != company_name.lower():
                    return top_name, company_name
    except Exception as e:
        print(f"Error resolving parent for {company_name}: {e}")
        
    return company_name, None


def fetch_company_info(company_name: str) -> dict | None:
    """
    Fetch company information from IGDB /v4/companies endpoint.
    Returns dict with name, description, logo_url, country, start_date, websites.
    """
    cache_key = f"igdb_company_info_{company_name.lower().replace(' ', '_')}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    token = get_igdb_token()
    if not token:
        return None

    resolved_name, resolved_from = resolve_top_parent_dynamically(company_name, token)

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    # Use exact match query to safely find the exact parent company
    names_array = [
        f'"{resolved_name}"', 
        f'"{resolved_name} Entertainment"', 
        f'"{resolved_name} Games"', 
        f'"{resolved_name} Studios"',
        f'"{resolved_name} Inc."',
        f'"{resolved_name} LLC"'
    ]
    query = f"""
        fields name, description, logo.url, country, start_date, 
               websites.url, websites.category, url, parent;
        where name = ({', '.join(names_array)});
        limit 5;
    """

    try:
        response = requests.post(
            'https://api.igdb.com/v4/companies',
            headers=headers,
            data=query,
            timeout=15
        )
        response.raise_for_status()
        data = response.json()

        if not data:
            # Fallback to wildcard search if the exact query fails
            fallback_query = f"""
                fields name, description, logo.url, country, start_date, 
                       websites.url, websites.category, url, parent;
                where name ~ *"{resolved_name}"*;
                limit 15;
            """
            response = requests.post('https://api.igdb.com/v4/companies', headers=headers, data=fallback_query, timeout=15)
            data = response.json()
            if not data:
                return None

        # Find best match: prioritize companies that do NOT have a parent
        best = None
        
        # Pass 1: exact match and no parent
        for company in data:
            c_name = company.get('name', '').lower()
            is_match = (c_name == resolved_name.lower() or "entertainment" in c_name or "games" in c_name or "studios" in c_name)
            if is_match and not company.get('parent'):
                best = company
                break
                
        # Pass 2: any company with no parent
        if not best:
            for company in data:
                if not company.get('parent'):
                    best = company
                    break
        
        # Pass 3: fallback
        if not best:
            best = data[0]

        # Parse logo
        logo_url = None
        if 'logo' in best and 'url' in best['logo']:
            logo_url = best['logo']['url']
        else:
            # Fallback: if the parent company lacks a logo, try to use a subsidiary's logo from the search results
            for c in data:
                if 'logo' in c and 'url' in c['logo']:
                    logo_url = c['logo']['url']
                    break

        if logo_url:
            if logo_url.startswith('//'):
                logo_url = f"https:{logo_url}"
            logo_url = logo_url.replace('t_thumb', 't_logo_med')

        # Parse websites
        websites = []
        for w in best.get('websites', []):
            websites.append({
                'url': w.get('url', ''),
                'category': w.get('category', 0)
            })

        # Parse start_date (unix timestamp)
        start_date = None
        if 'start_date' in best:
            import datetime
            try:
                start_date = datetime.datetime.fromtimestamp(best['start_date']).strftime('%Y-%m-%d')
            except Exception:
                pass

        result = {
            'name': best.get('name', resolved_name),
            'description': best.get('description', ''),
            'logo_url': logo_url,
            'country': best.get('country', None),
            'start_date': start_date,
            'websites': websites,
            'igdb_url': best.get('url', ''),
            'resolved_from': resolved_from,
        }
        
        cache.set(cache_key, result, 60 * 60 * 24)  # Cache for 24 hours
        return result

    except Exception as e:
        print(f"Error fetching IGDB company info for '{company_name}': {e}")
        return None


def fetch_company_games(company_name: str, limit: int = 150) -> list:
    """
    Fetch games developed or published by a company from IGDB.
    Returns list of dicts with id, name, cover_url, first_release_date, rating, igdb_id.
    """
    cache_key = f"igdb_company_games_{company_name.lower().replace(' ', '_')}"
    cached = cache.get(cache_key)
    if cached:
        return cached

    token = get_igdb_token()
    if not token:
        return []

    resolved_name, resolved_from = resolve_top_parent_dynamically(company_name, token)

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    # 1. Get exact parent company ID
    names_array = [
        f'"{resolved_name}"', 
        f'"{resolved_name} Entertainment"', 
        f'"{resolved_name} Games"', 
        f'"{resolved_name} Studios"'
    ]
    parent_query = f"fields id, name; where name = ({', '.join(names_array)}); limit 5;"
    company_ids = []
    
    try:
        r1 = requests.post('https://api.igdb.com/v4/companies', headers=headers, data=parent_query, timeout=10)
        if r1.status_code == 200:
            for c in r1.json():
                company_ids.append(str(c['id']))
                
        # 2. Get subsidiaries
        subs_query = f"fields id, name; where name ~ *\"{resolved_name}\"*; limit 50;"
        r2 = requests.post('https://api.igdb.com/v4/companies', headers=headers, data=subs_query, timeout=10)
        if r2.status_code == 200:
            for c in r2.json():
                cid = str(c['id'])
                if cid not in company_ids:
                    company_ids.append(cid)
                    
        if not company_ids:
            return []
            
        # Limit to 10 IDs max to prevent IGDB query errors
        company_ids = company_ids[:10]
        ids_str = ",".join(company_ids)

        # Now fetch games where ANY of these companies is involved (developer or publisher)
        # Note: We cannot filter by game.category directly in the where clause for involved_companies in IGDB v4.
        games_query = f"""
            fields game.name, game.cover.url, game.first_release_date, 
                   game.total_rating, game.id, game.category, game.parent_game, game.version_parent, developer, publisher;
            where company = ({ids_str}) & (developer = true | publisher = true);
            sort game.first_release_date desc;
            limit 200;
        """

        resp2 = requests.post(
            'https://api.igdb.com/v4/involved_companies',
            headers=headers,
            data=games_query,
            timeout=15
        )
        resp2.raise_for_status()
        involved = resp2.json()

        # Deduplicate by game id and filter categories
        seen_ids = set()
        games = []
        for item in involved:
            game_data = item.get('game')
            if not game_data or not isinstance(game_data, dict):
                continue
                
            gid = game_data.get('id')
            if gid in seen_ids:
                continue
                
            # Allow: 0 (Main), 1 (DLC), 2 (Expansion), 4 (Standalone Expansion), 8 (Remake), 9 (Remaster), 10 (Expanded), 11 (Port)
            cat = game_data.get('category', 0)
            if cat not in (0, 1, 2, 4, 8, 9, 10, 11):
                continue
                
            # Filter out different versions of the same game (e.g. Deluxe Edition)
            if game_data.get('version_parent'):
                continue
                
            # Filter out unwanted editions and packs using regex
            if is_unwanted_game(game_data.get('name', '')):
                continue
                
            # Filter out miscategorized sub-items: if it has a parent_game, it MUST be a DLC or Expansion.
            # If it's categorized as 0 (Main) but has a parent_game, it's likely a Season/Episode miscategorized.
            if game_data.get('parent_game') and cat not in (1, 2, 4):
                continue
                
            seen_ids.add(gid)

            cover_url = None
            if 'cover' in game_data and isinstance(game_data['cover'], dict):
                cover_url = game_data['cover'].get('url', '')
                if cover_url.startswith('//'):
                    cover_url = f"https:{cover_url}"
                cover_url = cover_url.replace('t_thumb', 't_cover_big')

            release_date = None
            if 'first_release_date' in game_data:
                import datetime
                try:
                    release_date = datetime.datetime.fromtimestamp(game_data['first_release_date']).strftime('%Y-%m-%d')
                except Exception:
                    pass

            games.append({
                'igdb_id': gid,
                'name': game_data.get('name', ''),
                'cover_url': cover_url,
                'release_date': release_date,
                'rating': round(game_data.get('total_rating', 0), 1) if game_data.get('total_rating') else None,
                'is_developer': item.get('developer', False),
                'is_publisher': item.get('publisher', False),
            })

            if len(games) >= limit:
                break

        if games:
            cache.set(cache_key, games, 60 * 60 * 24)  # Cache for 24 hours

        return games

    except Exception as e:
        print(f"Error fetching IGDB company games for '{company_name}': {e}")
        return []

def search_igdb_companies(query: str, limit: int = 5) -> list:
    """
    Search IGDB directly for companies matching the query.
    Returns a list of dicts with id, name, logo.
    """
    if not query:
        return []

    token = get_igdb_token()
    if not token:
        return []

    headers = {
        'Client-ID': IGDB_CLIENT_ID,
        'Authorization': f'Bearer {token}'
    }

    safe_query = query.replace('"', '').replace('\\', '')
    
    igdb_query = f'''
        where name ~ *"{safe_query}"*;
        fields name, logo.url;
        limit {limit};
    '''

    try:
        response = requests.post(
            'https://api.igdb.com/v4/companies',
            headers=headers,
            data=igdb_query,
            timeout=10
        )
        response.raise_for_status()
        data = response.json()
        
        results = []
        for c in data:
            logo_url = None
            if 'logo' in c and 'url' in c['logo']:
                logo_url = c['logo']['url']
                if logo_url.startswith('//'):
                    logo_url = f"https:{logo_url}"
                logo_url = logo_url.replace('t_thumb', 't_logo_med')
                
            results.append({
                'id': c.get('id'),
                'name': c.get('name', ''),
                'logo': logo_url,
                'type': 'company'
            })
            
        return results
    except Exception as e:
        print(f"Failed to search IGDB companies for '{query}': {e}")
        return []
