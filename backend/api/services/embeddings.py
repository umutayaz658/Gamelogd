"""
Language-agnostic post classification: replaces literal keyword matching
(which only recognizes the exact words someone happened to write it in)
with a multilingual sentence-embedding model. A post written in Turkish
("rol yapma oyunu") and one written in English ("role-playing game") land
close together in the model's vector space, so the same classifier works
regardless of what language the author used — no per-language keyword
lists to maintain.

Falls back to the older keyword-based heuristics (auto_categorize_post/
POST_CATEGORY_KEYWORDS in categorize.py) if the model can't be loaded
(e.g. no network on first run to fetch model weights), so post creation
never breaks because of this.
"""
import numpy as np

# Canonical, English-language descriptions of each concept. The model is
# multilingual, so a Turkish/Spanish/etc. post is compared directly against
# these — there's no need to translate the descriptions themselves.
INTEREST_DESCRIPTIONS = {
    'RPG': 'role-playing game, character builds, leveling up, story-driven quests, stats and skill trees',
    'FPS': 'first-person shooter, gunplay, aiming, weapons, multiplayer shooting game',
    'MMORPG': 'massively multiplayer online role-playing game, guilds, raids, persistent online world',
    'Indie': 'independent game development, small studio, solo developer, indie game',
    'Strategy': 'strategy game, tactics, base building, resource management, turn-based or real-time strategy',
    'Simulation': 'simulation game, management sim, life sim, realistic simulator',
    'Esports': 'competitive gaming, esports tournament, professional players, ranked competitive play',
    'News': 'gaming news, official announcement, reveal trailer, patch notes, release date update',
    'Invest': 'investing in games or studios, funding round, venture capital, startup pitch',
    'Retro': 'retro gaming, classic old games, nostalgia, old school console games',
    'Horror': 'horror game, scary, frightening, jump scares, survival horror',
    'Puzzle': 'puzzle game, brain teaser, logic puzzles',
    'Adventure': 'adventure game, exploration, narrative-driven journey',
    'Open World': 'open world game, sandbox, free roam, large explorable map',
    'Sci-Fi': 'science fiction game, space setting, futuristic technology, aliens',
    'Fantasy': 'fantasy game, magic, medieval setting, dragons, mythical creatures',
}

CATEGORY_DESCRIPTIONS = {
    'reviews': 'a review or rating of a game, opinion on its quality, a recommendation, a score out of ten',
    'gameplay': 'gameplay footage, a play session, a livestream, a playthrough',
    'news': 'gaming news, an announcement, an official reveal, a release date, patch notes',
    'discussion': 'a general discussion or opinion about a game or the gaming industry',
    'memes': 'a meme, a joke, a funny image or video about gaming',
    'esports': 'esports, a competitive tournament, a professional gaming league',
    'indie': 'indie game development, a solo developer, a small game studio',
    'devlogs': 'a development log, a progress update on a game being built',
    'tips': 'a tip, a guide, a tutorial, a walkthrough, strategy advice',
}

INTEREST_MATCH_THRESHOLD = 0.32
CATEGORY_FALLBACK = 'general'

_model = None
_interest_matrix = None
_category_matrix = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer
        _model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')
    return _model


def _get_interest_matrix():
    global _interest_matrix
    if _interest_matrix is None:
        model = _get_model()
        _interest_matrix = model.encode(list(INTEREST_DESCRIPTIONS.values()), normalize_embeddings=True)
    return _interest_matrix


def _get_category_matrix():
    global _category_matrix
    if _category_matrix is None:
        model = _get_model()
        _category_matrix = model.encode(list(CATEGORY_DESCRIPTIONS.values()), normalize_embeddings=True)
    return _category_matrix


def classify_interests(text):
    """Multi-label: returns every interest tag name the text is semantically close to."""
    text = (text or '').strip()
    if not text:
        return []
    model = _get_model()
    text_emb = model.encode(text, normalize_embeddings=True)
    sims = _get_interest_matrix() @ text_emb
    names = list(INTEREST_DESCRIPTIONS.keys())
    return [names[i] for i, sim in enumerate(sims) if sim >= INTEREST_MATCH_THRESHOLD]


def classify_category(text):
    """Single-label: best-matching post category, or 'general' if nothing is close enough."""
    text = (text or '').strip()
    if not text:
        return CATEGORY_FALLBACK
    model = _get_model()
    text_emb = model.encode(text, normalize_embeddings=True)
    sims = _get_category_matrix() @ text_emb
    names = list(CATEGORY_DESCRIPTIONS.keys())
    best = int(np.argmax(sims))
    return names[best] if sims[best] >= INTEREST_MATCH_THRESHOLD else CATEGORY_FALLBACK


def classify_post(post):
    """
    Full classification for a Post: (category, [interest tag names]).
    Structural hints (reply-to-a-review, devlog, news-comment, GIF-meme) are checked
    first — same as the old auto_categorize_post — because they're free, certain,
    and language-independent; embeddings only decide the ambiguous, organic-text case.
    Falls back to the keyword-based heuristics if the model isn't available.
    """
    if post.review_parent_id:
        category = 'reviews'
    elif post.project_parent_id:
        category = 'devlogs'
    elif post.news_parent_id:
        category = 'news'
    elif post.gif_url and len(post.content or '') < 50:
        category = 'memes'
    else:
        category = None

    text = post.content or ''

    try:
        if category is None:
            category = classify_category(text)
        interests = classify_interests(text)
        return category, interests
    except Exception:
        from api.services.categorize import auto_categorize_post
        return (category or auto_categorize_post(post)), []
