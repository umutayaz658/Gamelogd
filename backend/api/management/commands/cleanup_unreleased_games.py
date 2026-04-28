import time
from datetime import date
from django.core.management.base import BaseCommand
from core.models import Game
from api.models import LibraryEntry


class Command(BaseCommand):
    help = 'Cleans up unreleased, rumored, or fake games from the database'

    def handle(self, *args, **options):
        today = date.today()

        # Find games with release_date in the future
        future_games = Game.objects.filter(release_date__gt=today)

        # Find games with no release date and no Steam AppID
        null_date_games = Game.objects.filter(release_date__isnull=True, steam_appid__isnull=True)

        self.stdout.write(f'Future games found: {future_games.count()}')
        self.stdout.write(f'Null date games (without steam) found: {null_date_games.count()}')

        # Protect games that have library entries (meaning users played/owned them)
        protected_game_ids = list(LibraryEntry.objects.values_list('game_id', flat=True).distinct())

        future_to_delete = future_games.exclude(id__in=protected_game_ids)
        null_to_delete = null_date_games.exclude(id__in=protected_game_ids)

        future_count = future_to_delete.count()
        null_count = null_to_delete.count()

        self.stdout.write(f'Will delete {future_count} future games and {null_count} null-date games.')

        # Perform deletion
        if future_count > 0:
            future_to_delete.delete()
        if null_count > 0:
            null_to_delete.delete()

        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {future_count + null_count} unreleased/invalid games.'))
        self.stdout.write(self.style.SUCCESS(f'Total games remaining: {Game.objects.count()}'))
