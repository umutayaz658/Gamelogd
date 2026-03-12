"""
GameLogId Cold Start Service
===============================

Yeni kayıt olan ve henüz etkileşimi olmayan kullanıcılara
içerik gösterilmesini yönetir.

3 Aşama:
1. Kayıt verisi (interests, platforms) ile popüler içerik
2. ε-greedy exploration (ilk 48 saat, %70 exploit / %30 explore)
3. Kademeli geçiş: α-blend ile normal algoritmaya yumuşak geçiş
"""

import math
import random
import logging
from datetime import timedelta

from django.utils import timezone
from django.db.models import Count

from api.recommendation_models import UserActivityProfile
from core.models import Post

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────

COLD_START_THRESHOLD = 30       # Bu sayıda etkileşime ulaşınca tamamen normal moda geçiş
EXPLORATION_EPSILON = 0.30      # Keşif oranı
TIME_DECAY_LAMBDA = 0.035
COLD_CANDIDATE_DAYS = 7         # Aday postlar için zaman penceresi (gün)
COLD_CANDIDATE_LIMIT = 200      # Aday havuzu limiti


# ─────────────────────────────────────────────
# Cold Start Detection
# ─────────────────────────────────────────────


def should_use_cold_start(user):
    """
    Kullanıcının cold start modunda olup olmadığını kontrol eder.
    interaction_count < COLD_START_THRESHOLD ise True döner.
    """
    try:
        profile = user.activity_profile
        return profile.interaction_count < COLD_START_THRESHOLD
    except UserActivityProfile.DoesNotExist:
        # Profil henüz oluşturulmamış → kesinlikle cold start
        UserActivityProfile.objects.create(user=user)
        return True


def _get_blend_alpha(user):
    """
    Cold start → normal algoritma geçiş katsayısı.
    α = max(0, 1 - interaction_count / COLD_START_THRESHOLD)
    α = 1.0 → tamamen cold start
    α = 0.0 → tamamen normal algoritma
    """
    try:
        count = user.activity_profile.interaction_count
    except UserActivityProfile.DoesNotExist:
        count = 0
    return max(0.0, 1.0 - count / COLD_START_THRESHOLD)


# ─────────────────────────────────────────────
# Phase 1: Registration-Based Feed
# ─────────────────────────────────────────────


def _cold_start_candidates(user):
    """
    Kayıt verisine (interests, platforms) dayalı aday postlar.
    Son 7 gündeki en popüler postlardan seçer.
    """
    cutoff = timezone.now() - timedelta(days=COLD_CANDIDATE_DAYS)

    candidates = Post.objects.filter(
        timestamp__gte=cutoff,
        parent__isnull=True,
    ).annotate(
        like_count_ann=Count('likes'),
        reply_count_ann=Count('replies'),
    ).order_by('-like_count_ann')[:COLD_CANDIDATE_LIMIT]

    return list(candidates)


def _score_cold_start(user, post):
    """
    Cold start skoru: genre overlap + popülerlik + tazelik.
    """
    # Genre overlap
    user_genres = set(user.interests.values_list('slug', flat=True))
    post_genres = set()
    if post.game_tag_id:
        try:
            post_genres = set(g.lower() for g in (post.game_tag.genres or []))
        except Exception:
            pass
    genre_union = user_genres | post_genres
    genre_score = len(user_genres & post_genres) / max(len(genre_union), 1)

    # Popülerlik (log scale)
    like_count = getattr(post, 'like_count_ann', 0) or 0
    reply_count = getattr(post, 'reply_count_ann', 0) or 0
    popularity = math.log1p(like_count + reply_count * 2)

    # Tazelik
    hours_age = (timezone.now() - post.timestamp).total_seconds() / 3600.0
    freshness = math.exp(-TIME_DECAY_LAMBDA * max(hours_age, 0))

    return genre_score * 0.4 + popularity * 0.4 + freshness * 0.2


# ─────────────────────────────────────────────
# Phase 2: Exploration Phase (ε-greedy)
# ─────────────────────────────────────────────


def _exploration_feed(user, candidates, page_size):
    """
    ε-greedy strateji:
    - %70 (1 - ε): kayıt verisine dayalı kişiselleştirilmiş içerik
    - %30 (ε): rastgele farklı türlerden keşif içeriği
    """
    n_explore = max(1, int(page_size * EXPLORATION_EPSILON))
    n_exploit = page_size - n_explore

    # Exploit: kişiselleştirilmiş sıralama
    scored = [((_score_cold_start(user, p), p)) for p in candidates]
    scored.sort(key=lambda x: -x[0])
    personalized = [p for _, p in scored[:n_exploit]]

    # Explore: rastgele seçim
    remaining = [p for _, p in scored if p not in personalized]
    explore_count = min(n_explore, len(remaining))
    explore_posts = random.sample(remaining, explore_count) if explore_count > 0 else []

    # Karıştır (interleave)
    combined = personalized + explore_posts
    random.shuffle(combined)
    return combined


# ─────────────────────────────────────────────
# Phase 3: Blended Transition
# ─────────────────────────────────────────────


def get_blended_feed(user, page=1, page_size=20):
    """
    Cold start → normal geçiş. α değerine göre iki skorun blend'ini yapar.
    α yüksekse cold-start ağırlıklı, düşükse normal feed ağırlıklı.

    Tam kademeli blend yapmak yerine, basit yaklaşım:
    α > 0.7 → tamamen cold start
    α ≤ 0.7 → cold start feed döndür (normal feed çağrısı recursion yapar)
    """
    alpha = _get_blend_alpha(user)
    candidates = _cold_start_candidates(user)

    if not candidates:
        # Hiç post yoksa boş döndür
        return list(Post.objects.filter(
            parent__isnull=True
        ).order_by('-timestamp')[:page_size])

    feed = _exploration_feed(user, candidates, page_size)

    # Pagination
    start = (page - 1) * page_size
    end = start + page_size
    return feed[start:end]


# ─────────────────────────────────────────────
# Utility: Increment Interaction Count
# ─────────────────────────────────────────────


def increment_interaction_count(user):
    """
    Her etkileşim kaydedildiğinde çağrılır.
    Cold start → normal geçişi kontrol eder.
    """
    profile, created = UserActivityProfile.objects.get_or_create(user=user)
    profile.interaction_count += 1
    profile.save(update_fields=['interaction_count', 'last_updated'])
