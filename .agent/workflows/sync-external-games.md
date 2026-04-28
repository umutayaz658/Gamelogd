---
description: Syncing Games from Steam or IGDB (Handling API Gates & Issues)
---

# Syncing External Games

Guidelines for importing or synchronizing games with 3rd party APIs (Steam, Twitch/IGDB).

## Steam Sync (`api/services/steam.py`)
- **Age Gates:** Steam's `appdetails` API hides information (like genres) for 18+ games unless cookies showing the age are passed (`birthtime`, `wants_mature_content`). Ensure these cookies remain in the request.
- **Data Deduplication:** When importing, standard logic is `Game.objects.filter(title__iexact=title).first()`. Ensure games are not duplicated by minor punctuation differences by preferring IGDB ID or Steam App ID matching where possible.
- **Privacy:** If a user's Steam Profile Game Details are set to private, `GetOwnedGames` will return an empty list or a 403 Forbidden. The app handles this via `try...except` in the View.

## IGDB / Search
- The frontend "Log Game" search modal fetches dynamically from IGDB's API proxy logic, meaning users can search millions of games globally.
- Games are ONLY added to the PostgreSQL `core_game` table when explicitly logged by a user or imported via Steam.
- **Recommendation Engine ("Cold Start"):** The recommendation engine (`views.py -> recommended_games`) works purely on the PostgreSQL database cross-matching. If a user is the only person to sync their library, the engine will find empty pools (excluding already owned games). This is expected behavior that naturally resolves as more users sync their catalogs.
