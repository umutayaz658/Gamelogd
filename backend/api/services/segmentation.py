"""
GameLogId Segmentation Service
================================

Kullanıcıları ve postları otomatik segmentlere ayırır.
Algoritmadaki konumlarını görsel olarak göstermek için kullanılır.

Kullanıcı Segmentleri:
    - rookie    : Cold start (interaction_count < 30)
    - active    : Orta seviye aktif oyuncu
    - hardcore  : Yüksek etkileşim + geniş kütüphane
    - veteran   : Hardcore + eski hesap
    - dormant   : Uzun süredir etkileşim yok

Post Segmentleri:
    - trending  : Son 1 saatte yüksek etkileşim patlaması
    - rising    : Kısa sürede büyüyen yeni post
    - fresh     : 2 saatten yeni
    - popular   : Yüksek toplam beğeni/yorum
    - niche     : Kullanıcının ilgi alanına çok uygun
    - normal    : Yukarıdakilerin hiçbiri
"""

import logging
from datetime import timedelta

from django.utils import timezone
from django.db.models import Count

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# Segment Definitions
# ─────────────────────────────────────────────

USER_SEGMENTS = {
    'veteran': {
        'label': '👑 Veteran',
        'color': '#eab308',       # Altın sarısı
        'bg': 'rgba(234,179,8,0.12)',
    },
    'hardcore': {
        'label': '⚡ Hardcore',
        'color': '#a855f7',       # Mor
        'bg': 'rgba(168,85,247,0.12)',
    },
    'active': {
        'label': '🎮 Aktif',
        'color': '#3b82f6',       # Mavi
        'bg': 'rgba(59,130,246,0.12)',
    },
    'rookie': {
        'label': '🆕 Çaylak',
        'color': '#10b981',       # Yeşil
        'bg': 'rgba(16,185,129,0.12)',
    },
    'dormant': {
        'label': '💤 Uyuyan',
        'color': '#ef4444',       # Kırmızı
        'bg': 'rgba(239,68,68,0.12)',
    },
}

POST_SEGMENTS = {
    'trending': {
        'label': '🔥 Trending',
        'color': '#f97316',       # Turuncu
        'bg': 'rgba(249,115,22,0.12)',
    },
    'rising': {
        'label': '📈 Yükselen',
        'color': '#10b981',       # Yeşil
        'bg': 'rgba(16,185,129,0.12)',
    },
    'fresh': {
        'label': '✨ Taze',
        'color': '#3b82f6',       # Mavi
        'bg': 'rgba(59,130,246,0.12)',
    },
    'popular': {
        'label': '⭐ Popüler',
        'color': '#eab308',       # Altın
        'bg': 'rgba(234,179,8,0.12)',
    },
    'niche': {
        'label': '🎯 Niş',
        'color': '#a855f7',       # Mor
        'bg': 'rgba(168,85,247,0.12)',
    },
    'normal': {
        'label': '',
        'color': '#71717a',       # Gri
        'bg': 'transparent',
    },
}


# ─────────────────────────────────────────────
# User Segmentation
# ─────────────────────────────────────────────

COLD_START_THRESHOLD = 30
HARDCORE_THRESHOLD = 100
VETERAN_THRESHOLD = 200
VETERAN_ACCOUNT_DAYS = 30
HARDCORE_LIBRARY_MIN = 20
DORMANT_DAYS = 14
ACTIVE_RECENT_DAYS = 7


def get_user_segment(user):
    """
    Kullanıcıyı segmente ayırır.

    Öncelik sırası:
    1. Dormant   (son 14 gün hiç etkileşim yok)
    2. Veteran   (interaction ≥ 200, hesap > 30 gün)
    3. Hardcore  (interaction ≥ 100, library ≥ 20)
    4. Active    (interaction ≥ 30, son 7 gün aktif)
    5. Rookie    (cold start)

    Returns:
        dict: {"segment": str, "label": str, "color": str, "bg": str}
    """
    from api.recommendation_models import UserActivityProfile, PostInteraction

    # Profil bilgisi
    try:
        profile = user.activity_profile
        interaction_count = profile.interaction_count
    except UserActivityProfile.DoesNotExist:
        interaction_count = 0

    # Hesap yaşı (gün)
    account_age_days = (timezone.now() - user.date_joined).days

    # Kütüphane büyüklüğü
    library_size = user.library.count()

    # Son etkileşim zamanı
    last_interaction = PostInteraction.objects.filter(
        user=user
    ).order_by('-created_at').values_list('created_at', flat=True).first()

    days_since_last = None
    if last_interaction:
        days_since_last = (timezone.now() - last_interaction).days

    # ── Segment karar ağacı ──

    # 1. Dormant: Hesabı var ama uzun süredir etkileşim yok
    if interaction_count >= COLD_START_THRESHOLD and days_since_last is not None and days_since_last >= DORMANT_DAYS:
        return _build_user_segment('dormant')

    # 2. Veteran
    if interaction_count >= VETERAN_THRESHOLD and account_age_days >= VETERAN_ACCOUNT_DAYS:
        return _build_user_segment('veteran')

    # 3. Hardcore
    if interaction_count >= HARDCORE_THRESHOLD and library_size >= HARDCORE_LIBRARY_MIN:
        return _build_user_segment('hardcore')

    # 4. Active
    if interaction_count >= COLD_START_THRESHOLD:
        # Son 7 gün içinde etkileşim var mı?
        if days_since_last is not None and days_since_last <= ACTIVE_RECENT_DAYS:
            return _build_user_segment('active')
        # Etkileşimi var ama son zamanlarda aktif değil → yine active (henüz dormant eşiğini geçmedi)
        return _build_user_segment('active')

    # 5. Rookie (cold start)
    return _build_user_segment('rookie')


def _build_user_segment(key):
    info = USER_SEGMENTS[key]
    return {
        'segment': key,
        'label': info['label'],
        'color': info['color'],
        'bg': info['bg'],
    }


# ─────────────────────────────────────────────
# Post Segmentation
# ─────────────────────────────────────────────

TRENDING_1H_THRESHOLD = 10
RISING_3H_THRESHOLD = 5
RISING_MAX_AGE_HOURS = 12
FRESH_MAX_AGE_HOURS = 2
POPULAR_LIKES_THRESHOLD = 10
POPULAR_REPLIES_THRESHOLD = 5
NICHE_GENRE_THRESHOLD = 0.7


def get_post_segment(post, request_user=None):
    """
    Postu segmente ayırır.

    Öncelik sırası:
    1. Trending  (son 1 saatte ≥ 10 etkileşim)
    2. Rising    (son 3 saatte ≥ 5 etkileşim, yaş < 12 saat)
    3. Fresh     (yaş < 2 saat)
    4. Popular   (likes ≥ 10 veya replies ≥ 5)
    5. Niche     (kullanıcıya özel genre match > 0.7)
    6. Normal

    Args:
        post: Post instance
        request_user: İstek yapan kullanıcı (niche kontrolü için)

    Returns:
        dict: {"segment": str, "label": str, "color": str, "bg": str}
    """
    from api.recommendation_models import PostInteraction

    now = timezone.now()
    hours_age = (now - post.timestamp).total_seconds() / 3600.0

    # 1. Trending: Son 1 saatteki etkileşim sayısı
    one_hour_ago = now - timedelta(hours=1)
    recent_1h = PostInteraction.objects.filter(
        post=post,
        created_at__gte=one_hour_ago,
    ).count()

    if recent_1h >= TRENDING_1H_THRESHOLD:
        return _build_post_segment('trending')

    # 2. Rising: Son 3 saatteki etkileşim, post yeni
    three_hours_ago = now - timedelta(hours=3)
    recent_3h = PostInteraction.objects.filter(
        post=post,
        created_at__gte=three_hours_ago,
    ).count()

    if recent_3h >= RISING_3H_THRESHOLD and hours_age <= RISING_MAX_AGE_HOURS:
        return _build_post_segment('rising')

    # 3. Fresh: Çok yeni post
    if hours_age <= FRESH_MAX_AGE_HOURS:
        return _build_post_segment('fresh')

    # 4. Popular: Toplam beğeni/yorum eşiği
    like_count = post.likes.count()
    reply_count = post.replies.count()

    if like_count >= POPULAR_LIKES_THRESHOLD or reply_count >= POPULAR_REPLIES_THRESHOLD:
        return _build_post_segment('popular')

    # 5. Niche: Kullanıcının ilgi alanıyla yüksek örtüşme
    if request_user and post.game_tag_id:
        try:
            user_genres = set(request_user.interests.values_list('slug', flat=True))
            post_genres = set(g.lower() for g in (post.game_tag.genres or []))
            genre_union = user_genres | post_genres
            if genre_union:
                genre_match = len(user_genres & post_genres) / len(genre_union)
                if genre_match >= NICHE_GENRE_THRESHOLD:
                    return _build_post_segment('niche')
        except Exception:
            pass

    # 6. Normal
    return _build_post_segment('normal')


def _build_post_segment(key):
    info = POST_SEGMENTS[key]
    return {
        'segment': key,
        'label': info['label'],
        'color': info['color'],
        'bg': info['bg'],
    }
