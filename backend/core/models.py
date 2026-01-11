from django.db import models
from django.conf import settings

# User and Interest are now in api.models
# We import them or use settings.AUTH_USER_MODEL where appropriate

class Game(models.Model):
    title = models.CharField(max_length=255)
    cover_image = models.ImageField(upload_to='games/', blank=True, null=True)
    release_date = models.DateField(null=True, blank=True)
    igdb_id = models.IntegerField(unique=True, null=True, blank=True)

    def __str__(self):
        return self.title

class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='reviews')
    rating = models.DecimalField(max_digits=3, decimal_places=1)
    content = models.TextField(blank=True)
    
    # Flags
    is_liked = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    contains_spoilers = models.BooleanField(default=False)
    
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'game')
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.user.username} - {self.game.title} ({self.rating})"


class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    content = models.TextField(blank=True)
    image = models.ImageField(upload_to='posts/', blank=True, null=True)
    
    # Media Support
    media_file = models.FileField(upload_to='posts/media/', null=True, blank=True)
    media_type = models.CharField(max_length=20, choices=[('image', 'Image'), ('video', 'Video')], null=True, blank=True)
    gif_url = models.URLField(max_length=500, null=True, blank=True)
    
    # Poll Support
    poll_options = models.JSONField(null=True, blank=True, default=list)
    
    # Reply Support
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    review_parent = models.ForeignKey('Review', on_delete=models.CASCADE, null=True, blank=True, related_name='replies')
    news_parent = models.ForeignKey('News', on_delete=models.CASCADE, null=True, blank=True, related_name='comments')
    
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Post by {self.user.username} at {self.timestamp}"

class Like(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='likes')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='likes')
    review = models.ForeignKey(Review, on_delete=models.CASCADE, null=True, blank=True, related_name='likes')
    news = models.ForeignKey('News', on_delete=models.CASCADE, null=True, blank=True, related_name='likes')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'post'], ['user', 'review'], ['user', 'news']]

    def __str__(self):
        return f"{self.user} liked something"



class NewsSource(models.Model):
    CATEGORY_CHOICES = [
        ('invest', 'Investment'),
        ('devs', 'Development'),
        ('hardware', 'Hardware'),
        ('general', 'General'),
    ]
    name = models.CharField(max_length=255)
    rss_url = models.URLField()
    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES, default='general')
    icon = models.URLField(blank=True, null=True)

    def __str__(self):
        return self.name

class News(models.Model):
    source = models.ForeignKey(NewsSource, on_delete=models.CASCADE, related_name='news')
    title = models.CharField(max_length=500)
    link = models.URLField(unique=True, max_length=1000)
    image_url = models.URLField(blank=True, null=True, max_length=1000)
    description = models.TextField(blank=True)
    pub_date = models.DateTimeField()
    category = models.CharField(max_length=20, db_index=True)

    class Meta:
        ordering = ['-pub_date']
        verbose_name_plural = "News"

    def __str__(self):
        return self.title
