import logging
from django.core.management.base import BaseCommand
from core.models import Game
from core.utils import is_unwanted_game

class Command(BaseCommand):
    help = 'Cleans up unwanted games (editions, DLCs, seasons, bundles) from the database'

    def handle(self, *args, **kwargs):
        self.stdout.write('Starting database cleanup for unwanted games...')
        
        games = Game.objects.all()
        deleted_count = 0
        deleted_titles = []
        
        for game in games:
            if is_unwanted_game(game.title):
                deleted_titles.append(game.title)
                game.delete()
                deleted_count += 1
                
        self.stdout.write(self.style.SUCCESS(f'Successfully deleted {deleted_count} unwanted games.'))
        if deleted_titles:
            self.stdout.write('Deleted titles sample:')
            for title in deleted_titles[:50]:
                self.stdout.write(f' - {title}')
