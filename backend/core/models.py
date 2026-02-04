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


class Project(models.Model):
    STATUS_CHOICES = [
        ('in_dev', 'In Development'),
        ('alpha', 'Alpha'),
        ('beta', 'Beta'),
        ('released', 'Released'),
    ]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    title = models.CharField(max_length=255)
    description = models.TextField()
    cover_image = models.ImageField(upload_to='projects/', blank=True, null=True)
    tech_stack = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_dev')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class JobPosting(models.Model):
    JOB_TYPE_CHOICES = [
        ('full_time', 'Full-time'),
        ('part_time', 'Part-time'),
        ('contract', 'Contract'),
        ('rev_share', 'Rev-share'),
        ('hobby', 'Hobby'),
    ]
    LOCATION_TYPE_CHOICES = [
        ('remote', 'Remote'),
        ('on_site', 'On-site'),
        ('hybrid', 'Hybrid'),
    ]
    EXPERIENCE_LEVEL_CHOICES = [
        ('junior', 'Junior'),
        ('mid', 'Mid'),
        ('senior', 'Senior'),
        ('lead', 'Lead'),
    ]

    recruiter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='job_postings')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='jobs')
    title = models.CharField(max_length=255)
    description = models.TextField()
    job_type = models.CharField(max_length=20, choices=JOB_TYPE_CHOICES)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPE_CHOICES)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_LEVEL_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} at {self.project.title if self.project else 'Indie'}"

class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    title = models.CharField(max_length=255, blank=True, null=True) # For Devlogs
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
    project_parent = models.ForeignKey(Project, on_delete=models.CASCADE, null=True, blank=True, related_name='devlogs')
    
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Post by {self.user.username} at {self.timestamp}"

class PostMedia(models.Model):
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='media')
    file = models.FileField(upload_to='posts/media/')
    media_type = models.CharField(max_length=20, choices=[('image', 'Image'), ('video', 'Video')], default='image')
    order = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'created_at']

    def __str__(self):
        return f"Media for Post {self.post.id}"

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

class Pitch(models.Model):
    GENRE_CHOICES = [
        ('rpg', 'RPG'),
        ('fps', 'FPS'),
        ('strategy', 'Strategy'),
        ('simulation', 'Simulation'),
        ('adventure', 'Adventure'),
        ('platformer', 'Platformer'),
        ('puzzle', 'Puzzle'),
        ('other', 'Other'),
    ]
    PLATFORM_CHOICES = [
        ('pc', 'PC'),
        ('console', 'Console'),
        ('mobile', 'Mobile'),
        ('vr_ar', 'VR/AR'),
        ('web', 'Web'),
        ('multi', 'Multi-platform'),
    ]
    STAGE_CHOICES = [
        ('concept', 'Concept'),
        ('prototype', 'Prototype'),
        ('vertical_slice', 'Vertical Slice'),
        ('production', 'In Production'),
        ('alpha', 'Alpha'),
        ('beta', 'Beta'),
        ('early_access', 'Early Access'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='pitches')
    title = models.CharField(max_length=255)
    description = models.TextField()
    genre = models.CharField(max_length=20, choices=GENRE_CHOICES)
    platform = models.CharField(max_length=20, choices=PLATFORM_CHOICES)
    funding_goal = models.CharField(max_length=100, help_text="e.g. $50k-$100k")
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES)
    image = models.ImageField(upload_to='pitches/', blank=True, null=True)
    pitch_deck_url = models.URLField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} by {self.user.username}"


class InvestorCall(models.Model):
    INVESTOR_TYPE_CHOICES = [
        ('vc', 'Venture Capital'),
        ('publisher', 'Publisher'),
        ('angel', 'Angel Investor'),
        ('grant', 'Grant / Fund'),
        ('accelerator', 'Accelerator'),
    ]

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='investor_calls')
    organization_name = models.CharField(max_length=255)
    investor_type = models.CharField(max_length=20, choices=INVESTOR_TYPE_CHOICES)
    looking_for = models.TextField()
    ticket_size = models.CharField(max_length=100, help_text="e.g. $100k+")
    deadline = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.organization_name} ({self.get_investor_type_display()})"
