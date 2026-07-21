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
