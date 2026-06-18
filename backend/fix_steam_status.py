import os
import django

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from api.models import LibraryEntry

def fix_status():
    print("Finding Steam games with 'dropped' status...")
    # Find all LibraryEntry from Steam with dropped status
    entries = LibraryEntry.objects.filter(platform='Steam', status='dropped')
    count = entries.count()
    print(f"Found {count} dropped Steam games.")
    
    if count > 0:
        entries.update(status='unplayed')
        print(f"Successfully updated {count} Steam games to 'unplayed'.")
    else:
        print("Nothing to update.")

if __name__ == "__main__":
    fix_status()
