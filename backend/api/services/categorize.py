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
    """Calculate a trending score for a post based on engagement and recency."""
    now = timezone.now()
    age_hours = (now - post.timestamp).total_seconds() / 3600
    
    # Engagement counts
    likes_count = post.likes.count() if hasattr(post, 'likes') else 0
    replies_count = post.replies.count() if hasattr(post, 'replies') else 0
    reposts_count = post.reposts.count() if hasattr(post, 'reposts') else 0
    bookmarks_count = post.bookmarks.count() if hasattr(post, 'bookmarks') else 0
    
    # Weighted engagement score
    engagement = (
        likes_count * 1.0 +
        replies_count * 2.0 +
        reposts_count * 3.0 +
        bookmarks_count * 1.5
    )
    
    # Time multiplier (boost recent content)
    if age_hours <= 24:
        time_multiplier = 2.0
    elif age_hours <= 72:
        time_multiplier = 1.5
    else:
        time_multiplier = 1.0
    
    # Decay formula
    score = engagement * time_multiplier / (1 + age_hours * 0.1)
    
    return round(score, 4)


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
