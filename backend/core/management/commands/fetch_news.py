import feedparser
from bs4 import BeautifulSoup
from django.core.management.base import BaseCommand
from django.utils import timezone
from core.models import News, NewsSource
from datetime import datetime
import time
from time import mktime

class Command(BaseCommand):
    help = 'Fetches news from RSS feeds'

    def handle(self, *args, **options):
        # Auto-seed sources
        sources_data = [
            {'category': 'invest', 'name': 'GamesIndustry.biz', 'url': 'https://www.gamesindustry.biz/rss/gamesindustry/feed', 'icon': 'https://assets.gamesindustry.biz/favicon.ico'},
            {'category': 'devs', 'name': 'Game Developer', 'url': 'https://www.gamedeveloper.com/rss.xml', 'icon': 'https://www.gamedeveloper.com/favicon.ico'},
            {'category': 'hardware', 'name': 'Tom\'s Hardware', 'url': 'https://www.tomshardware.com/feeds/all', 'icon': 'https://www.tomshardware.com/favicon.ico'},
            {'category': 'general', 'name': 'IGN', 'url': 'https://www.ign.com/rss/articles/feed?tags=games', 'icon': 'https://assets1.ignimgs.com/2015/05/27/ign-logo-jpg__thumb.jpg'},
        ]

        for s in sources_data:
            NewsSource.objects.get_or_create(
                rss_url=s['url'],
                defaults={'name': s['name'], 'category': s['category'], 'icon': s['icon']}
            )

        sources = NewsSource.objects.all()
        for source in sources:
            self.stdout.write(f"Fetching {source.name}...")
            try:
                feed = feedparser.parse(source.rss_url)
                
                for entry in feed.entries[:10]: # Limit to 10 latest
                    if News.objects.filter(link=entry.link).exists():
                        continue

                    # Parse image
                    image_url = None
                    if hasattr(entry, 'media_content') and entry.media_content:
                        image_url = entry.media_content[0]['url']
                    elif hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
                        image_url = entry.media_thumbnail[0]['url']
                    else:
                        # Fallback: parse HTML description for img tag
                        soup = BeautifulSoup(entry.description, 'html.parser')
                        img = soup.find('img')
                        if img and 'src' in img.attrs:
                            image_url = img['src']

                    # Clean description
                    soup = BeautifulSoup(entry.description, 'html.parser')
                    description = soup.get_text()[:500] + "..." if len(soup.get_text()) > 500 else soup.get_text()

                    # Parse date
                    pub_date = timezone.now()
                    if hasattr(entry, 'published_parsed') and entry.published_parsed:
                         # timestamp to datetime
                         dt = datetime.fromtimestamp(mktime(entry.published_parsed))
                         pub_date = timezone.make_aware(dt) if timezone.is_naive(dt) else dt

                    News.objects.create(
                        source=source,
                        title=entry.title,
                        link=entry.link,
                        image_url=image_url,
                        description=description,
                        pub_date=pub_date,
                        category=source.category
                    )
                    self.stdout.write(f"  Saved: {entry.title}")
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"Error fetching {source.name}: {e}"))

        self.stdout.write(self.style.SUCCESS('Successfully fetched news'))
