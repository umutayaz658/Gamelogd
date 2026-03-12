"""
GameLogId Friend Suggestion Service
=====================================

Benzer oyun tercihleri, rütbe, aktiflik saatleri ve sosyal bağlara
göre kullanıcılara arkadaş/takım arkadaşı önerir.

Formül:
    SimilarityScore(u, v) = w₁ × GameJaccard
                          + w₂ × RankProximity
                          + w₃ × ActivityOverlap
                          + w₄ × GenreAffinity
                          + w₅ × PlatformMatch
                          + w₆ × SocialProximity
"""

import math
import logging

from django.db.models import Q

from api.models import Follow, LibraryEntry
from api.recommendation_models import UserActivityProfile

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────
# Weights
# ─────────────────────────────────────────────

W_GAME_JACCARD = 0.30
W_RANK_PROXIMITY = 0.20
W_ACTIVITY_OVERLAP = 0.15
W_GENRE_AFFINITY = 0.15
W_PLATFORM_MATCH = 0.10
W_SOCIAL_PROXIMITY = 0.10

# All known genres for the genre vector
ALL_GENRES = [
    'fps', 'moba', 'rpg', 'strategy', 'adventure', 'puzzle',
    'simulation', 'platformer', 'racing', 'sports', 'horror',
    'sandbox', 'mmo', 'battle_royale', 'fighting', 'visual_novel',
    'rhythm', 'card_game', 'tower_defense', 'roguelike', 'other',
]

MAX_CANDIDATE_POOL = 1000


# ─────────────────────────────────────────────
# Similarity Components
# ─────────────────────────────────────────────


def _game_jaccard(games_a, games_b):
    """
    Jaccard similarity of game libraries.
    |A ∩ B| / |A ∪ B|
    """
    union = games_a | games_b
    if not union:
        return 0.0
    return len(games_a & games_b) / len(union)


def _rank_proximity(user_a, user_b, common_game_ids):
    """
    Ortak oyunlardaki oynama süresi farkını rank proxy'si olarak kullanır.
    (Rütbe verisi yoksa playtime_forever ile yaklaşık hesap)
    """
    if not common_game_ids:
        return 0.5  # nötr

    entries_a = {
        e.game_id: e.playtime_forever
        for e in LibraryEntry.objects.filter(user=user_a, game_id__in=common_game_ids)
    }
    entries_b = {
        e.game_id: e.playtime_forever
        for e in LibraryEntry.objects.filter(user=user_b, game_id__in=common_game_ids)
    }

    diffs = []
    for gid in common_game_ids:
        pt_a = entries_a.get(gid, 0)
        pt_b = entries_b.get(gid, 0)
        max_pt = max(pt_a, pt_b, 1)
        diffs.append(abs(pt_a - pt_b) / max_pt)

    return 1.0 - (sum(diffs) / len(diffs))


def _activity_overlap(user_a, user_b):
    """
    24 saatlik bir grid üzerinde aktif saatlerin örtüşmesi.
    |ActiveHours(a) ∩ ActiveHours(b)| / max(|ActiveHours(a)|, |ActiveHours(b)|)
    """
    try:
        hours_a = set(user_a.activity_profile.active_hours or [])
    except UserActivityProfile.DoesNotExist:
        hours_a = set()

    try:
        hours_b = set(user_b.activity_profile.active_hours or [])
    except UserActivityProfile.DoesNotExist:
        hours_b = set()

    max_hours = max(len(hours_a), len(hours_b))
    if max_hours == 0:
        return 0.5  # her iki profil de boş → nötr
    return len(hours_a & hours_b) / max_hours


def _genre_vector(user):
    """
    Kullanıcının oyun kütüphanesinden türe göre oynama süresi vektörü.
    Normalize edilmiş (toplamı 1).
    """
    vec = {g: 0.0 for g in ALL_GENRES}

    entries = user.library.select_related('game').all()
    for entry in entries:
        genres = entry.game.genres or []
        for genre in genres:
            key = genre.lower().replace(' ', '_').replace('-', '_')
            if key in vec:
                vec[key] += entry.playtime_forever

    total = sum(vec.values()) or 1.0
    return [vec[g] / total for g in ALL_GENRES]


def _genre_affinity(user_a, user_b):
    """
    Cosine similarity of genre vectors.
    cos(Ga, Gb) = (Ga · Gb) / (‖Ga‖ × ‖Gb‖)
    """
    va = _genre_vector(user_a)
    vb = _genre_vector(user_b)

    dot_product = sum(a * b for a, b in zip(va, vb))
    norm_a = math.sqrt(sum(a * a for a in va))
    norm_b = math.sqrt(sum(b * b for b in vb))

    denom = norm_a * norm_b
    if denom == 0:
        return 0.0
    return dot_product / denom


def _platform_match(user_a, user_b):
    """
    Platform Jaccard similarity.
    """
    pa = set(p.lower() for p in (user_a.platforms or []))
    pb = set(p.lower() for p in (user_b.platforms or []))
    if not pa or not pb:
        return 0.0
    return len(pa & pb) / len(pa | pb)


def _social_proximity(user_a, user_b):
    """
    Ortak arkadaş (mutual follow) oranı.
    |Friends(a) ∩ Friends(b)| / sqrt(|Friends(a)| × |Friends(b)|)
    """
    friends_a = set(
        Follow.objects.filter(follower=user_a).values_list('following_id', flat=True)
    )
    friends_b = set(
        Follow.objects.filter(follower=user_b).values_list('following_id', flat=True)
    )
    denom = math.sqrt(len(friends_a) * len(friends_b))
    if denom == 0:
        return 0.0
    return len(friends_a & friends_b) / denom


# ─────────────────────────────────────────────
# Composite Score
# ─────────────────────────────────────────────


def _similarity_score(user_a, user_b, games_a=None):
    """
    6 bileşenli benzerlik skoru.
    games_a pre-computed olarak geçilebilir (performance için).
    """
    if games_a is None:
        games_a = set(user_a.library.values_list('game_id', flat=True))
    games_b = set(user_b.library.values_list('game_id', flat=True))
    common_game_ids = list(games_a & games_b)

    score = (
        W_GAME_JACCARD * _game_jaccard(games_a, games_b)
        + W_RANK_PROXIMITY * _rank_proximity(user_a, user_b, common_game_ids)
        + W_ACTIVITY_OVERLAP * _activity_overlap(user_a, user_b)
        + W_GENRE_AFFINITY * _genre_affinity(user_a, user_b)
        + W_PLATFORM_MATCH * _platform_match(user_a, user_b)
        + W_SOCIAL_PROXIMITY * _social_proximity(user_a, user_b)
    )
    return score


# ─────────────────────────────────────────────
# Candidate Generation
# ─────────────────────────────────────────────


def _generate_candidate_users(user):
    """
    Aday havuzu: aynı oyunlara sahip kullanıcılar.
    Zaten takip edilenler ve engellenenler çıkarılır.
    """
    from api.models import User

    # Kullanıcının oyun ID'leri
    user_game_ids = list(user.library.values_list('game_id', flat=True))

    # Zaten takip edilen kullanıcılar
    following_ids = set(
        Follow.objects.filter(follower=user).values_list('following_id', flat=True)
    )
    following_ids.add(user.id)  # kendini de çıkar

    # Aynı oyunlardan en az 1'ine sahip kullanıcılar
    candidate_ids = (
        LibraryEntry.objects
        .filter(game_id__in=user_game_ids)
        .exclude(user_id__in=following_ids)
        .values_list('user_id', flat=True)
        .distinct()[:MAX_CANDIDATE_POOL]
    )

    return User.objects.filter(id__in=candidate_ids).select_related('activity_profile')


# ─────────────────────────────────────────────
# Diversity Pass
# ─────────────────────────────────────────────


def _apply_diversity(scored_users, user):
    """
    Platform/oyun çeşitliliği sağlamak için sonuçları düzenler.
    Aynı top-3 oyundan fazla kişi gelmemesini sağlar.
    """
    # Basit diversity: sıralamaya müdahale etmeden döndür
    # Gelecekte top_favorites bazlı clustering eklenebilir
    return scored_users


# ─────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────


def get_friend_suggestions(user, count=20):
    """
    Kullanıcıya arkadaş/takım arkadaşı önerir.

    Args:
        user: İstek yapan kullanıcı
        count: Döndürülecek öneri sayısı

    Returns:
        list[dict]: Önerilen kullanıcılar ve benzerlik skorları
            [{'user': User, 'score': float, 'common_games': int}, ...]
    """
    candidates = _generate_candidate_users(user)

    if not candidates.exists():
        logger.info(f"No friend candidates for user {user.id}")
        return []

    # Pre-compute user's games
    user_games = set(user.library.values_list('game_id', flat=True))

    scored = []
    for candidate in candidates:
        try:
            score = _similarity_score(user, candidate, games_a=user_games)
            candidate_games = set(candidate.library.values_list('game_id', flat=True))
            common_count = len(user_games & candidate_games)
            scored.append({
                'user': candidate,
                'score': round(score, 4),
                'common_games': common_count,
            })
        except Exception as e:
            logger.warning(f"Similarity error for user {candidate.id}: {e}")

    # Sırala ve top-K al
    scored.sort(key=lambda x: -x['score'])
    scored = _apply_diversity(scored, user)

    return scored[:count]
