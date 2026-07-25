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
import logging
import threading

import numpy as np

logger = logging.getLogger(__name__)

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
    'Sports': 'sports video game, football, soccer, basketball, tennis, golf, FIFA, NBA, scoring a goal, playing a match, team, tournament, league, cup, athletic competition',
    'Racing': 'racing video game, cars, motorsport, driving, speed, tracks, circuits, Formula 1, drifting, rally, lap, finish line, overtaking opponents',
    'Battle Royale': 'battle royale video game, Fortnite, PUBG, Warzone, last player or team standing, shrinking safe zone, the zone closing in, parachute drop, looting, elimination, victory royale',
    'Fighting': 'fighting video game, Street Fighter, Tekken, Mortal Kombat, one-on-one combat, punches and kicks, combos, character moves, health bar, martial arts, versus battles',
    'Platformer': 'platformer game, jumping between platforms, side-scrolling levels, precision platforming',
    'Co-op': 'cooperative multiplayer game, playing together with friends, couch co-op, party games',
    'VR': 'virtual reality game, VR headset, immersive first-person virtual experience',
    'Visual Novel': 'visual novel, story-driven game with dialogue choices, branching narrative',
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

# Two separate thresholds, not one shared value: category descriptions and interest
# descriptions produce different baseline cosine-similarity distributions against real
# post text, so a value tuned for one over-fires on the other. Interest matching is
# multi-label (every tag above the bar gets attached), which is far more sensitive to a
# too-low threshold than category's single argmax pick — sampling real post text showed
# 0.32 tagging a single-topic RPG review with 13 of 16 interests (RPG, FPS, Esports,
# Horror, Puzzle, ...), because same-domain "game" descriptions all sit ~0.3-0.45 apart
# even when unrelated. 0.55 was the highest value that still kept genuine single-topic
# matches (e.g. a pure FPS post scored FPS at 0.563) while cutting that noise.
INTEREST_MATCH_THRESHOLD = 0.55
CATEGORY_MATCH_THRESHOLD = 0.32
CATEGORY_FALLBACK = 'general'

_model = None
_interest_matrix = None
_category_matrix = None

# classify_post_async runs classification on a background thread per post, so concurrent
# posts mean concurrent threads reaching this module at the same time. Verified by testing
# two simultaneous posts directly against a running server: without this lock, one post's
# result came back tagged with another post's interests (the shared SentenceTransformer
# instance is not safe for concurrent .encode() calls) — silently wrong data, not just a
# race on the lazy singleton init. Every encode() call funnels through _encode() below,
# which holds this lock for its whole duration, so concurrent posts queue instead of
# corrupting each other. Inference is already ~5-6s CPU-bound work, so serializing it adds
# queuing delay under concurrent load but doesn't change single-post latency.
_lock = threading.Lock()


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


def _encode(text):
    """Every embedding computation (single-text or the description matrices) goes through
    here, serialized by _lock — see the comment above it for why."""
    with _lock:
        model = _get_model()
        _get_interest_matrix()
        _get_category_matrix()
        return model.encode(text, normalize_embeddings=True)


def _interests_from_embedding(text_emb):
    sims = _get_interest_matrix() @ text_emb
    names = list(INTEREST_DESCRIPTIONS.keys())
    return [names[i] for i, sim in enumerate(sims) if sim >= INTEREST_MATCH_THRESHOLD]


def _category_from_embedding(text_emb):
    sims = _get_category_matrix() @ text_emb
    names = list(CATEGORY_DESCRIPTIONS.keys())
    best = int(np.argmax(sims))
    return names[best] if sims[best] >= CATEGORY_MATCH_THRESHOLD else CATEGORY_FALLBACK


def classify_interests(text):
    """Multi-label: returns every interest tag name the text is semantically close to."""
    text = (text or '').strip()
    if not text:
        return []
    text_emb = _encode(text)
    return _interests_from_embedding(text_emb)


def classify_category(text):
    """Single-label: best-matching post category, or 'general' if nothing is close enough."""
    text = (text or '').strip()
    if not text:
        return CATEGORY_FALLBACK
    text_emb = _encode(text)
    return _category_from_embedding(text_emb)


def classify_review(review):
    """
    Interest tags for a Review — same embedding model as classify_post, but reviews
    have no category field to assign, so this only returns tags. Falls back to an
    empty list if the model can't be loaded; FeedViewSet.for_you already falls back
    to keyword matching against review text when a review has no interests set.
    """
    try:
        return classify_interests(review.content)
    except Exception:
        return []


def classify_review_async(review_id):
    """
    Same rationale as classify_post_async: classify_review()'s model inference is
    5-10s+ on constrained CPU, so it runs on a background thread instead of blocking the
    review-creation/update response. Call via transaction.on_commit(...) so the thread
    never queries the Review before the row is actually committed and visible.
    """
    def _run():
        from django.db import connection
        from django.utils.text import slugify
        from core.models import Review
        from api.models import Interest
        try:
            review = Review.objects.get(pk=review_id)
            interest_names = classify_review(review)
            if interest_names:
                # get_or_create rather than filter — a tag may not have any Interest row
                # yet if no user has ever picked it at registration.
                matched = [
                    Interest.objects.get_or_create(name=name, defaults={'slug': slugify(name)})[0]
                    for name in interest_names
                ]
                review.interests.set(matched)
            else:
                # An edited review can legitimately end up with fewer/no matching tags —
                # clear stale ones from a previous classification rather than leaving them.
                review.interests.clear()
        except Review.DoesNotExist:
            pass
        except Exception:
            logger.exception("Background classification failed for review %s", review_id)
        finally:
            # Never closed by Django's normal request_finished cleanup (that only fires
            # for the request thread) — without this, every review leaks one connection.
            connection.close()

    threading.Thread(target=_run, daemon=True).start()


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

    text = (post.content or '').strip()

    try:
        if not text:
            interests = []
            if category is None:
                category = CATEGORY_FALLBACK
        else:
            # One encode() call for the post text, reused for both the category and
            # interest-tag comparisons — these used to each call model.encode(text)
            # independently, doubling inference time for no benefit (same input, same
            # embedding). Inference itself is CPU-bound and slow on Railway's allocated
            # CPU (~5-6s per call), so this halves per-post latency.
            text_emb = _encode(text)
            if category is None:
                category = _category_from_embedding(text_emb)
            interests = _interests_from_embedding(text_emb)
        return category, interests
    except Exception:
        from api.services.categorize import auto_categorize_post
        return (category or auto_categorize_post(post)), []


def classify_post_async(post_id, overwrite_category):
    """
    Runs classify_post() in a background thread instead of the request/response path —
    model inference takes 5-10s+ on Railway's allocated CPU (see the "Batches" timing in
    prod logs), which would otherwise make every single post creation wait that long.
    The post is already saved (with its default/client-given category and no interest
    tags) by the time this is called; this backfills category (only if the client didn't
    explicitly set one) and interest tags a few seconds later.

    Callers must invoke this via transaction.on_commit(...) so the background thread never
    queries the Post before the row that created it is actually committed and visible —
    it does its own fresh DB fetch/connection rather than reusing the request's.
    """
    def _run():
        from django.db import connection
        from django.utils.text import slugify
        from core.models import Post
        from api.models import Interest
        try:
            post = Post.objects.get(pk=post_id)
            category, interest_names = classify_post(post)
            update_fields = []
            if overwrite_category:
                post.category = category
                update_fields.append('category')
            if update_fields:
                post.save(update_fields=update_fields)
            if interest_names:
                # get_or_create rather than filter — a tag may not have any Interest row
                # yet if no user has ever picked it at registration.
                matched = [
                    Interest.objects.get_or_create(name=name, defaults={'slug': slugify(name)})[0]
                    for name in interest_names
                ]
                post.interests.set(matched)
        except Post.DoesNotExist:
            pass
        except Exception:
            logger.exception("Background classification failed for post %s", post_id)
        finally:
            # This thread's DB connection is never closed by Django's normal
            # request_finished cleanup (that only fires for the request thread) — without
            # this, every post creation leaks one open connection.
            connection.close()

    threading.Thread(target=_run, daemon=True).start()
