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
