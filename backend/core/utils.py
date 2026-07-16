import re

# Compile regex patterns once for performance
UNWANTED_PATTERNS = [
    r'\bdeluxe edition\b', r'\bpremium edition\b', r'\bgoty\b', r'\bgame of the year\b',
    r'\bultimate edition\b', r'\bgold edition\b', r'\bcomplete edition\b', 
    r'\bseason pass\b', r'\bexpansion pass\b', r'\bsoundtrack\b', r'\bartbook\b', 
    r'\bbundle\b', r'\bbonus content\b', r'\bpre-order\b', r'\bstarter pack\b', 
    r'\bfounder\'s pack\b', r'\bseason \d+\b', r'\bepisode \d+\b', 
    r'\bdlc\b', r'\+ bonus\b', r'\+ extra\b', r'\bpack\b',
    r'\bcollection\b', r'\bcompilation\b', r'\btrilogy\b', r'\bquadrilogy\b', 
    r'\banthology\b', r'\bdouble pack\b', r'\btriple pack\b', r'\bfranchise pack\b',
    r' \+ ', r'- nintendo switch .* edition\b', r'\benhanced edition\b'
]

UNWANTED_REGEXES = [re.compile(p, re.IGNORECASE) for p in UNWANTED_PATTERNS]

def is_unwanted_game(title: str) -> bool:
    """
    Checks if a game title matches unwanted standalone content formats 
    like editions, seasons, DLCs, or packs.
    Returns True if the game is unwanted and should be excluded.
    """
    if not title:
        return False
        
    # Exceptions for legitimate games that contain matched words or symbols
    lower_title = title.lower()
    if "mario + rabbids" in lower_title:
        return False
        
    for regex in UNWANTED_REGEXES:
        if regex.search(title):
            return True
            
    return False


# ============================================================
# Xbox / Cross-Platform Title Normalization & Filtering
# ============================================================

# Non-game applications that Xbox API returns as type "Game" but aren't actual games.
# These are matched case-insensitively against the FULL title.
XBOX_NON_GAME_BLACKLIST = [
    # Microsoft built-in apps
    'microsoft solitaire collection',
    'microsoft treasure hunt',
    'microsoft minesweeper',
    'microsoft jigsaw',
    'microsoft mahjong',
    'microsoft sudoku',
    'microsoft casual games',
    'microsoft wordament',
    'desert stalker',
    # Launchers & stores
    'minecraft launcher',
    'xbox game pass',
    'xbox insider hub',
    'xbox game bar',
    'ea play',
    'ea desktop',
    'ubisoft connect',
    'epic games launcher',
    'geforce now',
    'xbox accessories',
    'xbox cloud gaming',
    # Media apps
    'netflix',
    'spotify',
    'youtube',
    'disney+',
    'amazon prime video',
    'twitch',
    'crunchyroll',
    'hulu',
    'plex',
    'vlc',
    # System utilities
    'xbox avatars',
    'groove music',
    'films & tv',
    'movies & tv',
    'skype',
    'microsoft edge',
    'microsoft store',
]

# Platform suffixes to strip from Xbox titles (order matters - longer/more specific first)
_PLATFORM_SUFFIX_PATTERNS = [
    # "for Xbox ..." patterns MUST come before bare "Xbox ..." patterns
    r'\s*for Xbox Series X\|S\s*$',
    r'\s*for Xbox Series X/S\s*$',
    r'\s*for Xbox One\s*$',
    # Dash-prefixed patterns
    r'\s*[-–—]\s*Xbox Series X\|S\s*$',
    r'\s*[-–—]\s*Xbox Series X/S\s*$',
    r'\s*[-–—]\s*Xbox One\s*$',
    # Bare platform suffixes
    r'\s*Xbox Series X\|S\s*$',
    r'\s*Xbox Series X/S\s*$',
    r'\s*Xbox One\s*$',
    # Short codes
    r'\s*[-–—]\s*XBS/X\s*$',
    r'\s*[-–—]\s*XB1\s*$',
    # Windows/PC suffixes
    r'\s*[-–—]\s*Windows Edition\s*$',
    r'\s*[-–—]\s*Windows 10 Edition\s*$',
    r'\s*WINDOWS EDITION\s*$',
    r'\s*\(Xbox One\)\s*$',
    r'\s*\(Xbox Series X\|S\)\s*$',
    r'\s*\(PC\)\s*$',
    r'\s*\(Windows\)\s*$',
    r'\s*[-–—]\s*PC\s*$',
]

# Edition/variant suffixes to strip (preserving the base game name)
_EDITION_SUFFIX_PATTERNS = [
    r'\s*[-–—]\s*Standard Edition\s*$',
    r'\s*[-–—]\s*Deluxe Edition\s*$',
    r'\s*[-–—]\s*Premium Edition\s*$',
    r'\s*[-–—]\s*Gold Edition\s*$',
    r'\s*[-–—]\s*Ultimate Edition\s*$',
    r'\s*[-–—]\s*Digital Edition\s*$',
    r'\s*[-–—]\s*Complete Edition\s*$',
    r'\s*[-–—]\s*Definitive Edition\s*$',
    r'\s*[-–—]\s*Game of the Year Edition\s*$',
    r'\s*[-–—]\s*GOTY Edition\s*$',
    r'\s*[-–—]\s*Legendary Edition\s*$',
    r'\s*[-–—]\s*Special Edition\s*$',
    r'\s*Standard Edition\s*$',
    r'\s*Deluxe Edition\s*$',
    r'\s*Premium Edition\s*$',
    r'\s*Gold Edition\s*$',
    r'\s*Digital Edition\s*$',
]

# Prefix patterns to strip
_PREFIX_PATTERNS = [
    r'^Full Game\s*[-–—]\s*',
]

# Parenthetical tags to strip
_PAREN_PATTERNS = [
    r'\s*\(Game Preview\)\s*',
    r'\s*\(Preview\)\s*',
    r'\s*\(Early Access\)\s*',
    r'\s*\(Open Beta\)\s*',
    r'\s*\(Beta\)\s*',
    r'\s*\(Free to Play\)\s*',
    r'\s*\(Free\)\s*',
]

# Compile all patterns once at module load
_PLATFORM_REGEXES = [re.compile(p, re.IGNORECASE) for p in _PLATFORM_SUFFIX_PATTERNS]
_EDITION_REGEXES = [re.compile(p, re.IGNORECASE) for p in _EDITION_SUFFIX_PATTERNS]
_PREFIX_REGEXES = [re.compile(p, re.IGNORECASE) for p in _PREFIX_PATTERNS]
_PAREN_REGEXES = [re.compile(p, re.IGNORECASE) for p in _PAREN_PATTERNS]

# Trademark symbols regex
_TRADEMARK_RE = re.compile(r'[™®©]')
# Multiple spaces regex
_MULTI_SPACE_RE = re.compile(r'\s{2,}')


def is_xbox_non_game(title: str) -> bool:
    """
    Returns True if the title is a known non-game application (launcher, media app, etc.).
    Works for any user's library, not specific to any account.
    """
    if not title:
        return True
    lower = title.strip().lower()
    # Exact blacklist match
    if lower in XBOX_NON_GAME_BLACKLIST:
        return True
    # Partial match patterns for common non-game patterns
    non_game_keywords = ['open beta', 'closed beta', 'tech test', 'playtest', 'insider']
    # Only filter these if they're the ENTIRE title context (e.g. "UFL Open Beta")
    # Don't filter "Palworld" just because it has "(Game Preview)" — that gets normalized
    if any(lower == kw or lower.endswith(f' {kw}') for kw in non_game_keywords):
        return True
    return False


def normalize_game_title(title: str) -> str:
    """
    Generic title normalization for cross-platform deduplication.
    Strips trademark symbols and normalizes whitespace.
    Used by both Steam and Xbox sync pipelines.
    """
    if not title:
        return ''
    result = title.strip()
    # Remove trademark symbols
    result = _TRADEMARK_RE.sub('', result)
    # Normalize whitespace
    result = _MULTI_SPACE_RE.sub(' ', result).strip()
    return result


def normalize_xbox_title(raw_title: str) -> str:
    """
    Full normalization pipeline for Xbox titles.
    Strips platform suffixes, edition variants, prefixes, parenthetical tags,
    and trademark symbols to produce a clean base game name.
    
    Examples:
        'EA SPORTS FC™ 25 Xbox Series X|S' -> 'EA SPORTS FC 25'
        'Full Game - Psychonauts'           -> 'Psychonauts'
        'Palworld (Game Preview)'           -> 'Palworld'
        'Steelrising - Standard Edition'    -> 'Steelrising'
        'Cloudpunk - XBS/X'                 -> 'Cloudpunk'
        'Fallout 4 (PC)'                    -> 'Fallout 4'
        'FINAL FANTASY XV WINDOWS EDITION'  -> 'FINAL FANTASY XV'
    """
    if not raw_title:
        return ''
    
    result = raw_title.strip()
    
    # Step 1: Remove prefix patterns (e.g. "Full Game - ")
    for regex in _PREFIX_REGEXES:
        result = regex.sub('', result)
    
    # Step 2: Remove platform suffixes (e.g. "Xbox Series X|S")
    for regex in _PLATFORM_REGEXES:
        result = regex.sub('', result)
    
    # Step 3: Remove edition suffixes (e.g. "- Standard Edition")
    for regex in _EDITION_REGEXES:
        result = regex.sub('', result)
    
    # Step 4: Remove parenthetical tags (e.g. "(Game Preview)")
    for regex in _PAREN_REGEXES:
        result = regex.sub('', result)
    
    # Step 5: Remove trademark symbols
    result = _TRADEMARK_RE.sub('', result)
    
    # Step 6: Normalize whitespace
    result = _MULTI_SPACE_RE.sub(' ', result).strip()
    
    # Step 7: Strip trailing dash/hyphen left over from removals
    result = re.sub(r'\s*[-–—]\s*$', '', result).strip()
    
    return result

