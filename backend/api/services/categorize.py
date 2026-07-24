from django.utils import timezone
from datetime import timedelta

POST_CATEGORY_KEYWORDS = {
    'reviews': ['review', 'rating', 'score', '/10', 'recommend', 'worth', 'rated', 'stars'],
    'gameplay': ['gameplay', 'playthrough', 'stream', 'playing', 'session', 'lets play', 'gaming'],
    'news': ['announced', 'release', 'update', 'patch', 'launch', 'trailer', 'reveal', 'confirmed'],
    'memes': ['meme', 'funny', 'lol', 'lmao', 'bruh', 'fr fr', 'no cap'],
    'esports': ['tournament', 'esports', 'competitive', 'rank', 'league', 'championship', 'qualifier'],
    'indie': ['indie', 'solo dev', 'small studio', 'indie game', 'indie dev'],
    'devlogs': ['devlog', 'development', 'progress update', 'building', 'coding', 'dev update'],
    'tips': ['tip', 'guide', 'how to', 'tutorial', 'trick', 'strategy', 'walkthrough', 'build guide'],
}

def auto_categorize_post(post):
    """Automatically categorize a post based on its content and relationships."""
    # Check structural hints first
    if post.review_parent_id:
        return 'reviews'
    if post.project_parent_id:
        return 'devlogs'
    if post.news_parent_id:
        return 'news'
    
    content_lower = (post.content or '').lower()
    
    # Check for GIF (likely meme)
    if post.gif_url and len(content_lower) < 50:
        return 'memes'
    
    # Keyword matching with scoring
    scores = {}
    for category, keywords in POST_CATEGORY_KEYWORDS.items():
        score = sum(1 for kw in keywords if kw in content_lower)
        if score > 0:
            scores[category] = score
    
    if scores:
        return max(scores, key=scores.get)
    
    # If post has a game tag, it's likely a discussion
    if hasattr(post, 'game') and post.game:
        return 'discussion'
    
    return 'general'


def calculate_trending_score(post):
    """
    Advanced social feed ranking algorithm inspired by Instagram, Twitter, and LinkedIn.
    Designed to maximize session length, user retention, and viral loop engagement.
    """
    now = timezone.now()
    age_hours = (now - post.timestamp).total_seconds() / 3600
    
    # 1. Base Engagement Metrics
    likes_count = post.likes.count() if hasattr(post, 'likes') else 0
    replies_count = post.replies.count() if hasattr(post, 'replies') else 0
    reposts_count = post.reposts.count() if hasattr(post, 'reposts') else 0
    bookmarks_count = post.bookmarks.count() if hasattr(post, 'bookmarks') else 0
    
    # 2. Rich Media Boost (Instagram/Twitter: visual content gets 35% boost for higher dwell time)
    media_boost = 1.0
    if post.image or post.gif_url or (hasattr(post, 'media_file') and post.media_file):
        media_boost = 1.35
    elif len(post.content or '') > 280:
        # LinkedIn Dwell Time: long high-quality text posts get 15% boost
        media_boost = 1.15
        
    # 3. Conversation Thread Boost (Twitter/LinkedIn: rewarding active discussion threads)
    thread_boost = 1.0
    if replies_count > 0:
        # Check if multiple distinct users are replying
        distinct_reply_users = post.replies.values('user').distinct().count()
        if distinct_reply_users > 1:
            thread_boost = 1.25
        
        # Check if the post creator is active in their own thread (encourages community building)
        creator_replied = post.replies.filter(user=post.user).exists()
        if creator_replied:
            thread_boost *= 1.15

    # 4. External Link Penalty (Twitter/LinkedIn: penalty for posts driving users out of Gamelogd)
    link_penalty = 1.0
    if 'http' in (post.content or '') and not (post.image or post.gif_url):
        link_penalty = 0.85

    # 5. Weighted Engagement Score
    # - Reposts: 4.5 (highest viral value, creates new distribution nodes)
    # - Bookmarks: 3.5 (high utility value, indicates content users want to return to)
    # - Replies: 2.5 (conversational value, drives dwell time)
    # - Likes: 1.0 (low-friction positive feedback)
    weighted_engagement = (
        likes_count * 1.0 +
        replies_count * 2.5 +
        reposts_count * 4.5 +
        bookmarks_count * 3.5
    )
    
    # 6. Gravity Decay Formula (HackerNews/Reddit style decay)
    # Gravity constant determines how fast posts drop off. 1.5 is standard for active social feeds.
    gravity = 1.5
    raw_score = (weighted_engagement + 1.0) * media_boost * thread_boost * link_penalty
    decayed_score = raw_score / ((age_hours + 2.0) ** gravity)
    
    return round(decayed_score, 4)


# Registration "Taste Profile" interests (see frontend/src/app/register/page.tsx) are
# broad genre/topic tags, not literal words people use in posts — matching a post's
# content against just the bare tag name ("RPG", "Strategy", ...) misses almost
# everything. This expands each tag into the related words/phrases people actually
# write, used both by Explore's per-interest pill filter and by the For You
# personalization's keyword-match scoring.
INTEREST_KEYWORDS = {
    'RPG': ['rpg', 'role-playing', 'role playing'],
    'FPS': ['fps', 'first-person shooter', 'first person shooter'],
    'MMORPG': ['mmorpg', 'mmo'],
    'Indie': ['indie'],
    'Strategy': ['strategy', 'strategic', 'tactics', 'tactical'],
    'Simulation': ['simulation', 'simulator'],
    'Esports': ['esports', 'e-sports', 'tournament', 'competitive'],
    'News': ['news', 'announced', 'announcement', 'release', 'update', 'patch', 'trailer', 'reveal'],
    'Invest': ['invest', 'investment', 'funding', 'pitch', 'startup'],
    'Retro': ['retro', 'classic', 'old school', 'oldschool', 'nostalgia'],
    'Horror': ['horror', 'scary', 'creepy'],
    'Puzzle': ['puzzle'],
    'Adventure': ['adventure'],
    'Open World': ['open world', 'open-world', 'sandbox'],
    'Sci-Fi': ['sci-fi', 'scifi', 'science fiction'],
    'Fantasy': ['fantasy'],
}


def expand_interest_keywords(interest_names):
    """Flatten a list of interest tag names into their lowercased keyword variants."""
    keywords = set()
    for name in interest_names:
        keywords.update(kw.lower() for kw in INTEREST_KEYWORDS.get(name, [name]))
    return keywords


def score_post_for_user(post, user, followed_users_ids, user_interest_ids):
    """
    Per-user relevance score for a root Post — the Explore "For You" pill's scoring,
    factored out so it stays identical to FeedViewSet.for_you's own scoring loop
    (recency decay + engagement + follow affinity + interest-tag overlap) instead
    of drifting into a second, slightly-different implementation.

    `user_interest_ids` is the set of Interest PKs the user picked at registration;
    matched against `post.interests` (auto-assigned via embedding classification at
    post-creation time, see api.services.embeddings.classify_post) — expects
    `post.interests` to already be prefetched by the caller's queryset.
    """
    now = timezone.now()
    score = 10.0

    age_in_days = (now - post.timestamp).total_seconds() / 86400.0
    score *= 1.0 / (1.0 + age_in_days * 0.5)

    likes = getattr(post, 'likes_count_ann', 0) or 0
    replies = getattr(post, 'replies_count_ann', 0) or 0
    score += likes * 0.5
    score += replies * 0.8

    if user.is_authenticated:
        if post.user_id in followed_users_ids:
            score += 5.0

        matched_interests = len({i.id for i in post.interests.all()} & user_interest_ids)
        score += min(matched_interests * 3.0, 6.0)

    return score


def update_all_trending_scores():
    """Update trending scores for all recent posts."""
    from core.models import Post
    
    cutoff = timezone.now() - timedelta(days=7)
    posts = Post.objects.filter(
        timestamp__gte=cutoff,
        parent__isnull=True,
        review_parent__isnull=True,
        news_parent__isnull=True
    )
    
    for post in posts.iterator():
        new_score = calculate_trending_score(post)
        if post.trending_score != new_score:
            Post.objects.filter(id=post.id).update(trending_score=new_score)
