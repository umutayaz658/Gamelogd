"""
GameLogId Feed Ranking Service
===============================

Kullanıcının ana sayfasında gösterilecek gönderileri kişiselleştirilmiş
bir skor ile sıralar.

Formül:
    FeedScore(u, p) = AffinityScore(u, author(p))
                    × EngagementWeight(p)
                    × ContentRelevance(u, p)
                    × TimeDecay(p)
                    + ViralityBoost(p)
"""

import math
import logging
from datetime import timedelta

from django.utils import timezone
from django.db.models import Count, Q

from api.models import Follow
from api.recommendation_models import PostInteraction, UserActivityProfile, PostScoreCache
from core.models import Post

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Configurable Constants
# ─────────────────────────────────────────────

TIME_DECAY_LAMBDA = 0.035        # Yarı ömür ≈ 20 saat
CANDIDATE_WINDOW_HOURS = 72      # Aday postlar için zaman penceresi
MAX_CANDIDATES = 500             # Skorlama yapılacak max aday sayısı
MAX_POSTS_PER_USER = 3           # Diversity: bir kullanıcıdan max post
INTERACTION_WINDOW_DAYS = 30     # Affinity: etkileşim penceresi
INTERACTION_NORMALIZE_CAP = 50   # Affinity: max sayı normalizasyonu
VIRALITY_EXPECTED_AVG = 5        # Virality: beklenen saatlik ortalama

ENGAGEMENT_WEIGHTS = {
    'view': 0.05,
    'like': 0.15,
    'comment': 0.30,
    'share': 0.35,
    'play_request': 0.50,
}


# ─────────────────────────────────────────────
# Core Scoring Functions
# ─────────────────────────────────────────────


def _time_decay(post_timestamp):
    """Exponential time decay: e^(-λ × hours_age)"""
    hours_age = (timezone.now() - post_timestamp).total_seconds() / 3600.0
    return math.exp(-TIME_DECAY_LAMBDA * max(hours_age, 0))


def _affinity_score(user, author):
    """
    Kullanıcı ile gönderi sahibi arasındaki bağ kuvveti.
    Bileşenler: takip durumu, son etkileşimler, ortak oyunlar.
    """
    # 1) Following?
    is_following = 1.0 if Follow.objects.filter(
        follower=user, following=author
    ).exists() else 0.0

    # 2) Recent interactions
    recent_cutoff = timezone.now() - timedelta(days=INTERACTION_WINDOW_DAYS)
    interaction_count = PostInteraction.objects.filter(
        user=user,
        post__user=author,
        created_at__gte=recent_cutoff,
    ).count()
    interaction_ratio = min(interaction_count / INTERACTION_NORMALIZE_CAP, 1.0)

    # 3) Common games (Jaccard)
    user_games = set(user.library.values_list('game_id', flat=True))
    author_games = set(author.library.values_list('game_id', flat=True))
    union = user_games | author_games
    common_game_ratio = len(user_games & author_games) / len(union) if union else 0.0

    return (0.30 * is_following
            + 0.45 * interaction_ratio
            + 0.25 * common_game_ratio)


def _engagement_weight(post):
    """
    Gönderinin aldığı etkileşimlerin ağırlıklı toplamı (logaritmik dampening).
    PostScoreCache varsa cache'den okur, yoksa DB'den hesaplar.
    """
    try:
        cache = post.score_cache
        counts = {
            'view': cache.view_count,
            'like': cache.like_count,
            'comment': cache.comment_count,
            'share': cache.share_count,
            'play_request': cache.play_request_count,
        }
    except PostScoreCache.DoesNotExist:
        counts = _compute_interaction_counts(post)

    raw = sum(ENGAGEMENT_WEIGHTS[k] * counts.get(k, 0) for k in ENGAGEMENT_WEIGHTS)
    return math.log1p(raw)


def _compute_interaction_counts(post):
    """DB'den etkileşim sayılarını hesaplar."""
    qs = PostInteraction.objects.filter(post=post).values(
        'interaction_type'
    ).annotate(cnt=Count('id'))

    counts = {row['interaction_type']: row['cnt'] for row in qs}
    # Like ve comment, mevcut Like/Reply modelleri + PostInteraction'dan toplanır
    counts['like'] = counts.get('like', 0) + post.likes.count()
    counts['comment'] = counts.get('comment', 0) + post.replies.count()
    return counts


def _content_relevance(user, post):
    """
    Gönderinin kullanıcı ilgi alanlarıyla örtüşme derecesi.
    Bileşenler: tür eşleşmesi, platform eşleşmesi, medya tercihi.
    """
    # Genre match
    user_genre_slugs = set(user.interests.values_list('slug', flat=True))
    post_genres = set()
    if post.game_tag_id:
        try:
            post_genres = set(g.lower() for g in (post.game_tag.genres or []))
        except Exception:
            pass
    genre_union = user_genre_slugs | post_genres
    genre_match = len(user_genre_slugs & post_genres) / len(genre_union) if genre_union else 0.3

    # Platform match
    user_platforms = set(p.lower() for p in (user.platforms or []))
    post_platform = (post.platform_tag or '').lower().strip()
    if post_platform and user_platforms:
        platform_match = 1.0 if post_platform in user_platforms else 0.3
    else:
        platform_match = 0.5  # bilinmeyen → nötr

    # Media preference
    media_pref = _user_media_preference(user, post.media_type)

    return genre_match * 0.5 + platform_match * 0.2 + media_pref * 0.3


def _user_media_preference(user, media_type):
    """Kullanıcının geçmiş etkileşimlerindeki medya türü tercihini döndürür."""
    try:
        prefs = user.activity_profile.media_preferences
        if prefs and media_type:
            return prefs.get(media_type, 0.33)
    except UserActivityProfile.DoesNotExist:
        pass
    return 0.33  # varsayılan nötr


def _virality_boost(post):
    """Son 1 saatteki etkileşim patlamasını ödüllendiren bonus skor."""
    one_hour_ago = timezone.now() - timedelta(hours=1)
    recent_count = PostInteraction.objects.filter(
        post=post,
        created_at__gte=one_hour_ago,
    ).count()
    if recent_count <= VIRALITY_EXPECTED_AVG:
        return 0.0
    return max(0, math.log2(recent_count / VIRALITY_EXPECTED_AVG) - 1) * 0.15


# ─────────────────────────────────────────────
# Candidate Generation
# ─────────────────────────────────────────────


def _generate_candidates(user):
    """
    Skorlama adaylarını seçer. 3 kaynaktan alınır:
    1) Takip edilen kullanıcıların postları
    2) Kullanıcının oyunlarıyla etiketlenmiş postlar
    3) Genel popüler postlar (like sayısına göre)
    """
    cutoff = timezone.now() - timedelta(hours=CANDIDATE_WINDOW_HOURS)

    following_ids = list(
        Follow.objects.filter(follower=user).values_list('following_id', flat=True)
    )

    user_game_ids = list(
        user.library.values_list('game_id', flat=True)
    )

    # Takip edilen + oyun etiketli + popüler
    candidates = Post.objects.filter(
        Q(user_id__in=following_ids)
        | Q(game_tag_id__in=user_game_ids)
        | Q(likes__isnull=False),  # en az 1 like almış
        timestamp__gte=cutoff,
        parent__isnull=True,  # sadece ana postlar, reply değil
    ).select_related(
        'user', 'game_tag', 'score_cache'
    ).distinct().order_by('-timestamp')[:MAX_CANDIDATES]

    return list(candidates)


# ─────────────────────────────────────────────
# Diversity Injection
# ─────────────────────────────────────────────


def _apply_diversity(scored_posts, max_per_user=MAX_POSTS_PER_USER):
    """Aynı kullanıcıdan max N post geçmesini sağlar."""
    user_counts = {}
    result = []
    for score, post in scored_posts:
        uid = post.user_id
        user_counts[uid] = user_counts.get(uid, 0) + 1
        if user_counts[uid] <= max_per_user:
            result.append((score, post))
    return result


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────


def get_ranked_feed(user, page=1, page_size=20):
    """
    Ana feed sıralama fonksiyonu.

    Args:
        user: İstek yapan kullanıcı
        page: Sayfa numarası (1-indexed)
        page_size: Sayfa başına post sayısı

    Returns:
        list[Post]: Sıralanmış post listesi
    """
    # Cold start kontrolü
    from api.services.cold_start import should_use_cold_start, get_blended_feed
    if should_use_cold_start(user):
        return get_blended_feed(user, page, page_size)

    # 1) Aday oluştur
    candidates = _generate_candidates(user)
    if not candidates:
        logger.info(f"No candidates for user {user.id}, falling back to recent posts")
        return list(Post.objects.filter(
            parent__isnull=True
        ).order_by('-timestamp')[:page_size])

    # 2) Skorla
    scored = []
    for post in candidates:
        try:
            affinity = _affinity_score(user, post.user)
            engagement = _engagement_weight(post)
            relevance = _content_relevance(user, post)
            decay = _time_decay(post.timestamp)
            virality = _virality_boost(post)

            feed_score = (affinity * engagement * relevance * decay) + virality
            scored.append((feed_score, post))
        except Exception as e:
            logger.warning(f"Scoring error for post {post.id}: {e}")
            scored.append((0.0, post))

    # 3) Sırala
    scored.sort(key=lambda x: -x[0])

    # 4) Diversity
    scored = _apply_diversity(scored)

    # 5) Paginate
    start = (page - 1) * page_size
    end = start + page_size
    return [post for _, post in scored[start:end]]
