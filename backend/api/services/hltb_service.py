from howlongtobeatpy import HowLongToBeat

def fetch_hltb_times(game_title: str) -> dict:
    """
    Searches HowLongToBeat for the given game_title and returns the times in hours.
    Returns a dictionary with keys: hltb_main, hltb_main_extra, hltb_completionist.
    If not found, values will be None.
    """
    try:
        results = HowLongToBeat().search(game_title)
        if results is not None and len(results) > 0:
            # We take the best match, typically the first one
            best_match = max(results, key=lambda element: element.similarity)
            return {
                'hltb_main': best_match.main_story if best_match.main_story else None,
                'hltb_main_extra': best_match.main_extra if best_match.main_extra else None,
                'hltb_completionist': best_match.completionist if best_match.completionist else None
            }
    except Exception as e:
        print(f"Error fetching HLTB times for {game_title}: {e}")
        
    return {
        'hltb_main': None,
        'hltb_main_extra': None,
        'hltb_completionist': None
    }
