from django.core.management.base import BaseCommand
from core.models import Post
from api.models import PostHashtag, extract_hashtags


class Command(BaseCommand):
    help = (
        'Backfills PostHashtag rows for existing posts created before the trending-hashtags '
        'feature shipped (the post_save signal only covers posts saved after it was added). '
        'Safe to re-run — uses ignore_conflicts so it never duplicates rows.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--dry-run', action='store_true', help='Preview counts without saving')

    def handle(self, *args, **options):
        dry_run = options['dry_run']

        # content has no DB index, so this is an unavoidable full sequential scan — use
        # .iterator() so the whole Post table isn't materialized into memory at once.
        posts = Post.objects.exclude(content='').iterator(chunk_size=2000)

        scanned = 0
        with_tags = 0
        batch = []
        batch_size = 1000

        def flush(batch):
            if not batch:
                return
            if dry_run:
                return
            PostHashtag.objects.bulk_create(batch, ignore_conflicts=True, batch_size=batch_size)

        for post in posts:
            scanned += 1
            tags = extract_hashtags(post.content)
            if tags:
                with_tags += 1
                batch.extend(PostHashtag(post=post, tag=t) for t in tags)
            if len(batch) >= batch_size:
                flush(batch)
                batch = []

        flush(batch)

        prefix = '[DRY RUN] ' if dry_run else ''
        self.stdout.write(self.style.SUCCESS(
            f'{prefix}Scanned {scanned} posts, {with_tags} contained at least one hashtag.'
        ))
