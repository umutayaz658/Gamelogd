"""
Management Command: update_recommendation_caches
==================================================

Periyodik olarak çalıştırılarak PostScoreCache ve UserActivityProfile
tablolarını günceller.

Kullanım:
    python manage.py update_recommendation_caches

Celery Beat ile:
    Her 5 dakikada bir çalıştırılması önerilir.
"""

import math
import logging
from datetime import timedelta
from collections import Counter

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.db.models import Count

from core.models import Post
from api.recommendation_models import PostInteraction, PostScoreCache, UserActivityProfile
from api.models import User

logger = logging.getLogger(__name__)

ENGAGEMENT_WEIGHTS = {
    'view': 0.05, 'like': 0.15, 'comment': 0.30,
    'share': 0.35, 'play_request': 0.50,
}


class Command(BaseCommand):
    help = 'PostScoreCache ve UserActivityProfile tablolarını günceller.'

    def add_arguments(self, parser):
        parser.add_argument(
            '--posts-window-hours',
            type=int,
            default=168,  # 7 gün
            help='Kaç saatlik postlar güncellensin (varsayılan: 168 = 7 gün)'
        )
        parser.add_argument(
            '--users-window-days',
            type=int,
            default=30,
            help='Kullanıcı activity profile için etkileşim penceresi (gün)'
        )

    def handle(self, *args, **options):
        posts_window = options['posts_window_hours']
        users_window = options['users_window_days']

        self.stdout.write(self.style.NOTICE('Updating PostScoreCache...'))
        self._update_post_scores(posts_window)

        self.stdout.write(self.style.NOTICE('Updating UserActivityProfiles...'))
        self._update_user_profiles(users_window)

        self.stdout.write(self.style.SUCCESS('✅ Recommendation caches updated successfully.'))

    def _update_post_scores(self, window_hours):
        cutoff = timezone.now() - timedelta(hours=window_hours)
        posts = Post.objects.filter(timestamp__gte=cutoff, parent__isnull=True)
        updated = 0

        for post in posts.iterator():
            # Etkileşim sayıları
            interaction_qs = PostInteraction.objects.filter(post=post).values(
                'interaction_type'
            ).annotate(cnt=Count('id'))
            counts = {row['interaction_type']: row['cnt'] for row in interaction_qs}

            view_count = counts.get('view', 0)
            like_count = counts.get('like', 0) + post.likes.count()
            comment_count = counts.get('comment', 0) + post.replies.count()
            share_count = counts.get('share', 0)
            play_request_count = counts.get('play_request', 0)

            # Engagement score
            raw = (
                ENGAGEMENT_WEIGHTS['view'] * view_count
                + ENGAGEMENT_WEIGHTS['like'] * like_count
                + ENGAGEMENT_WEIGHTS['comment'] * comment_count
                + ENGAGEMENT_WEIGHTS['share'] * share_count
                + ENGAGEMENT_WEIGHTS['play_request'] * play_request_count
            )
            engagement_score = math.log1p(raw)

            # Virality score (son 1 saat)
            one_hour_ago = timezone.now() - timedelta(hours=1)
            recent_count = PostInteraction.objects.filter(
                post=post, created_at__gte=one_hour_ago
            ).count()
            expected_avg = 5
            virality_score = 0.0
            if recent_count > expected_avg:
                virality_score = max(0, math.log2(recent_count / expected_avg) - 1) * 0.15

            PostScoreCache.objects.update_or_create(
                post=post,
                defaults={
                    'engagement_score': engagement_score,
                    'virality_score': virality_score,
                    'view_count': view_count,
                    'like_count': like_count,
                    'comment_count': comment_count,
                    'share_count': share_count,
                    'play_request_count': play_request_count,
                }
            )
            updated += 1

        self.stdout.write(f'  → {updated} post scores updated.')

    def _update_user_profiles(self, window_days):
        cutoff = timezone.now() - timedelta(days=window_days)
        active_user_ids = PostInteraction.objects.filter(
            created_at__gte=cutoff
        ).values_list('user_id', flat=True).distinct()

        updated = 0
        for user_id in active_user_ids:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                continue

            interactions = PostInteraction.objects.filter(
                user=user, created_at__gte=cutoff
            )

            # Active hours: en çok etkileşim yapılan saatler
            hour_counts = Counter()
            for ts in interactions.values_list('created_at', flat=True):
                hour_counts[ts.hour] += 1
            # En aktif 6 saati al
            active_hours = [h for h, _ in hour_counts.most_common(6)]

            # Media preferences
            media_counts = Counter()
            post_ids = interactions.values_list('post_id', flat=True).distinct()
            for post in Post.objects.filter(id__in=post_ids).only('media_type'):
                mt = post.media_type or 'text'
                media_counts[mt] += 1
            total_media = sum(media_counts.values()) or 1
            media_prefs = {k: round(v / total_media, 3) for k, v in media_counts.items()}

            # Total interaction count
            total_interactions = interactions.count()

            profile, _ = UserActivityProfile.objects.update_or_create(
                user=user,
                defaults={
                    'active_hours': sorted(active_hours),
                    'media_preferences': media_prefs,
                    'interaction_count': total_interactions,
                }
            )
            updated += 1

        self.stdout.write(f'  → {updated} user profiles updated.')
