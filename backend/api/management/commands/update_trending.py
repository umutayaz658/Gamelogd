from django.core.management.base import BaseCommand
from api.services.categorize import update_all_trending_scores

class Command(BaseCommand):
    help = 'Update trending scores for all recent posts'

    def handle(self, *args, **options):
        self.stdout.write('Updating trending scores...')
        update_all_trending_scores()
        self.stdout.write(self.style.SUCCESS('Trending scores updated successfully.'))
