from django.db import models
from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator

# User and Interest are now in api.models
# We import them or use settings.AUTH_USER_MODEL where appropriate

class Game(models.Model):
    title = models.CharField(max_length=255, db_index=True)
    cover_image = models.ImageField(upload_to='games/', blank=True, null=True)
    release_date = models.DateField(null=True, blank=True)
    igdb_id = models.IntegerField(unique=True, null=True, blank=True)
    steam_appid = models.IntegerField(unique=True, null=True, blank=True)
    genres = models.JSONField(default=list, blank=True)
    # Game detail fields (populated on-demand from IGDB)
    summary = models.TextField(blank=True, default='')
    description = models.TextField(blank=True, default='')
    developer = models.CharField(max_length=255, blank=True, default='')
    publisher = models.CharField(max_length=255, blank=True, default='')
    screenshots = models.JSONField(default=list, blank=True)
    platforms = models.JSONField(default=list, blank=True)
    igdb_url = models.URLField(blank=True, default='', max_length=500)
    details_fetched = models.BooleanField(default=False)
    
    # Game Stats (Metacritic & HowLongToBeat)
    metacritic_score = models.IntegerField(null=True, blank=True)
    hltb_main = models.FloatField(null=True, blank=True)
    hltb_main_extra = models.FloatField(null=True, blank=True)
    hltb_completionist = models.FloatField(null=True, blank=True)

    def __str__(self):
        return self.title

class Review(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='reviews')
    game = models.ForeignKey(Game, on_delete=models.CASCADE, related_name='reviews')
    rating = models.DecimalField(
        max_digits=3, decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
    )
    content = models.TextField(blank=True)

    # Flags
    is_liked = models.BooleanField(default=False)
    is_completed = models.BooleanField(default=False)
    contains_spoilers = models.BooleanField(default=False)

    # Replay tracking
    playthrough_number = models.PositiveIntegerField(default=1)

    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        unique_together = ('user', 'game', 'playthrough_number')
        ordering = ['-timestamp']
        constraints = [
            # Ratings are on a 0–10 scale; without this a client/import could store e.g. 99.9
            # and skew every average-rating aggregation.
            models.CheckConstraint(
                condition=models.Q(rating__gte=0) & models.Q(rating__lte=10),
                name='review_rating_between_0_and_10',
            ),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.game.title} ({self.rating})"


class Organisation(models.Model):
    name = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True, default='')
    logo = models.ImageField(upload_to='organisations/logos/', blank=True, null=True)
    banner = models.ImageField(upload_to='organisations/banners/', blank=True, null=True)
    
    # Social Links
    website = models.URLField(blank=True, default='')
    twitter = models.URLField(blank=True, default='')
    youtube = models.URLField(blank=True, default='')
    # Arbitrary user-added links beyond the three standard ones above, e.g. [{"label": "Discord", "url": "..."}]
    extra_links = models.JSONField(default=list, blank=True)

    # Verification
    is_verified = models.BooleanField(default=False)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

class Role(models.Model):
    """
    Custom role: a named bundle of granular permission-key strings (see
    api.permission_catalog.PERMISSION_CATALOG). When `project` is null, this
    is an organisation-wide role (assignable on OrganisationMember and, via
    legacy-role fallback, implicitly to the org owner/admins across every
    project). When `project` is set, this role belongs to that single
    project only and is assignable exclusively to that project's
    ProjectMember rows — organisation roles and project roles are
    intentionally separate catalogs, never interchangeable.
    """
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name='roles')
    project = models.ForeignKey('Project', on_delete=models.CASCADE, null=True, blank=True, related_name='roles')
    name = models.CharField(max_length=100)
    description = models.CharField(max_length=255, blank=True, default='')
    permissions = models.JSONField(default=list, blank=True)
    is_system = models.BooleanField(default=False)
    is_default_for = models.CharField(max_length=20, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['organisation', 'name'], condition=models.Q(project__isnull=True), name='unique_org_role_name'),
            models.UniqueConstraint(fields=['project', 'name'], condition=models.Q(project__isnull=False), name='unique_project_role_name'),
        ]
        ordering = ['-is_system', 'name']

    def __str__(self):
        scope = self.project.title if self.project_id else self.organisation.name
        return f"{self.name} ({scope})"


class OrganisationMember(models.Model):
    ROLE_CHOICES = [
        ('owner', 'Owner'),
        ('admin', 'Admin'),
        ('member', 'Developer'),
    ]
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organisation_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='member')
    custom_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='org_member_assignments')
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organisation', 'user')

    def __str__(self):
        return f"{self.user.username} ({self.role}) at {self.organisation.name}"

class OrganisationFollow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followed_organisations')
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'organisation')

class OrganisationInvitation(models.Model):
    organisation = models.ForeignKey(Organisation, on_delete=models.CASCADE, related_name='invitations')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='organisation_invitations')
    role = models.CharField(max_length=20, choices=OrganisationMember.ROLE_CHOICES, default='member')
    custom_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='org_invitation_assignments')
    invited_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='sent_organisation_invitations')
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('organisation', 'user')


class Project(models.Model):
    STATUS_CHOICES = [
        ('in_dev', 'In Development'),
        ('alpha', 'Alpha'),
        ('beta', 'Beta'),
        ('released', 'Released'),
    ]
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='projects')
    organisation = models.ForeignKey(Organisation, on_delete=models.SET_NULL, null=True, blank=True, related_name='projects')
    title = models.CharField(max_length=255)
    description = models.TextField()
    cover_image = models.ImageField(upload_to='projects/', blank=True, null=True)
    logo = models.ImageField(upload_to='projects/logos/', blank=True, null=True)
    tech_stack = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_dev')

    # Social Links — mirrors Organisation's social fields so a project's public profile can
    # carry its own links independent of any parent organisation.
    website = models.URLField(blank=True, default='')
    twitter = models.URLField(blank=True, default='')
    youtube = models.URLField(blank=True, default='')
    extra_links = models.JSONField(default=list, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

class ProjectFollow(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='followed_projects')
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='followers')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'project')

    def __str__(self):
        return f"{self.user.username} follows {self.project.title}"

class ProjectMember(models.Model):
    ROLE_CHOICES = [
        ('participant', 'Participant'),
        ('editor', 'Editor'),
        ('admin', 'Admin'),
    ]
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
    ]
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='project_memberships')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='participant')
    custom_role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True, related_name='project_member_assignments')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('project', 'user')

    def __str__(self):
        return f"{self.user.username} - {self.role} at {self.project.title}"


class PlaytestFeedback(models.Model):
    """
    Public, membership-free feedback on a project, submitted directly by any logged-in app user.
    Deliberately a real relational model rather than the generic WorkspaceState JSON blob
    everything else in the Devs workspace uses, because this needs to be publicly readable and
    writable by non-members — both of which the member-scoped WorkspaceState access rules can't
    support.
    """
    TYPE_CHOICES = [
        ('bug', 'Bug'), ('suggestion', 'Suggestion'), ('crash', 'Crash'),
        ('ui_ux', 'UI/UX'), ('performance', 'Performance'), ('other', 'Other'),
    ]
    # Deliberately the exact same key set as frontend/src/components/devs/WorkspaceTypes.ts's
    # TaskPriority ('low'/'medium'/'high'/'urgent') — when a feedback item is converted to a
    # Kanban task, its priority carries over 1:1 with no translation table needed.
    PRIORITY_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('urgent', 'Urgent')]
    STATUS_CHOICES = [('open', 'Open'), ('in_progress', 'In Progress'), ('resolved', 'Resolved')]

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='playtest_feedback')
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='playtest_feedback')

    title = models.CharField(max_length=200, blank=True, default='')
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES)
    build_version = models.CharField(max_length=50, blank=True, default='')
    description = models.TextField()

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    is_pinned = models.BooleanField(default=False)
    converted_task_id = models.CharField(max_length=64, blank=True, default='')

    submitted_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_pinned', '-submitted_at']

    def __str__(self):
        return f"Feedback on {self.project.title}"


class JobPosting(models.Model):
    JOB_TYPE_CHOICES = [
        ('full_time', 'Full-time'),
        ('part_time', 'Part-time'),
        ('contract', 'Contract'),
        ('rev_share', 'Rev-share'),
        ('hobby', 'Hobby'),
    ]
    POST_TYPE_CHOICES = [
        ('job', 'Job Offering'),
        ('talent', 'Talent Profile'),
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
    post_type = models.CharField(max_length=20, choices=POST_TYPE_CHOICES, default='job')
    tech_stack = models.JSONField(default=list, blank=True)
    job_type = models.CharField(max_length=20, choices=JOB_TYPE_CHOICES)
    location_type = models.CharField(max_length=20, choices=LOCATION_TYPE_CHOICES)
    experience_level = models.CharField(max_length=20, choices=EXPERIENCE_LEVEL_CHOICES)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.title} at {self.project.title if self.project else 'Indie'}"

# Explore categorization choices
POST_CATEGORIES = [
    ('reviews', 'Reviews'),
    ('gameplay', 'Gameplay'),
    ('news', 'News'),
    ('discussion', 'Discussion'),
    ('memes', 'Memes'),
    ('esports', 'Esports'),
    ('indie', 'Indie'),
    ('devlogs', 'Dev Logs'),
    ('tips', 'Tips & Guides'),
    ('general', 'General'),
]

class Post(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='posts')
    author_identity = models.CharField(
        max_length=20, 
        choices=[('user', 'User'), ('organisation', 'Organisation'), ('project', 'Project')], 
        default='user'
    )
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
    repost_parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='reposts')
    repost_parent_review = models.ForeignKey('Review', on_delete=models.CASCADE, null=True, blank=True, related_name='reposts')
    
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    # Explore categorization
    category = models.CharField(max_length=20, choices=POST_CATEGORIES, default='general', db_index=True)
    trending_score = models.FloatField(default=0.0, db_index=True)
    # Auto-assigned (language-agnostic embedding classification, see
    # api.services.embeddings.classify_post) tags matching the same "Taste Profile"
    # interests users pick at registration — backs Explore's per-interest pill filter
    # and the For You feed's personalization, without re-scanning post text per request.
    interests = models.ManyToManyField('api.Interest', blank=True, related_name='tagged_posts')

    class Meta:
        indexes = [
            # Backs the Explore "popular" ordering (root posts, recent, by score). The individual
            # db_index on trending_score/timestamp can't serve the combined sort in one scan.
            models.Index(fields=['-trending_score', '-timestamp'], name='post_trending_recent_idx'),
        ]

    def __str__(self):
        return f"Post by {self.user.username} at {self.timestamp}"

    def save(self, *args, **kwargs):
        # A Post is exactly one shape: a normal post, a reply (parent / review_parent /
        # news_parent), a devlog (project_parent), or a repost (repost_parent /
        # repost_parent_review). Enforce that at most one parent/target pointer is set so
        # structurally inconsistent rows (e.g. a "reply that is also a repost") can't be created
        # by any code path, import or buggy client — the exclusivity was previously only implied
        # by elif chains in the signals/categorization.
        from django.core.exceptions import ValidationError
        parent_refs = [
            self.parent_id, self.review_parent_id, self.news_parent_id,
            self.project_parent_id, self.repost_parent_id, self.repost_parent_review_id,
        ]
        if sum(1 for ref in parent_refs if ref is not None) > 1:
            raise ValidationError("A Post may reference at most one parent, target or repost source.")
        # Organisation/project authorship only makes sense on a devlog attached to a project.
        if self.author_identity != 'user' and self.project_parent_id is None:
            raise ValidationError("Organisation/project authorship requires a project_parent.")
        super().save(*args, **kwargs)

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
    playtest_feedback = models.ForeignKey(PlaytestFeedback, on_delete=models.CASCADE, null=True, blank=True, related_name='likes')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'post'], ['user', 'review'], ['user', 'news'], ['user', 'playtest_feedback']]
        constraints = [
            # Exactly one target must be set. The nullable FKs + NULL-permeable unique_together
            # otherwise permit an all-NULL "like" that inflates counts while pointing at nothing.
            models.CheckConstraint(
                condition=(
                    models.Q(post__isnull=False, review__isnull=True, news__isnull=True, playtest_feedback__isnull=True)
                    | models.Q(post__isnull=True, review__isnull=False, news__isnull=True, playtest_feedback__isnull=True)
                    | models.Q(post__isnull=True, review__isnull=True, news__isnull=False, playtest_feedback__isnull=True)
                    | models.Q(post__isnull=True, review__isnull=True, news__isnull=True, playtest_feedback__isnull=False)
                ),
                name='like_exactly_one_target',
            ),
        ]

    def __str__(self):
        return f"{self.user} liked something"

class Bookmark(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bookmarks')
    post = models.ForeignKey(Post, on_delete=models.CASCADE, null=True, blank=True, related_name='bookmarks')
    review = models.ForeignKey(Review, on_delete=models.CASCADE, null=True, blank=True, related_name='bookmarks')
    news = models.ForeignKey('News', on_delete=models.CASCADE, null=True, blank=True, related_name='bookmarks')
    timestamp = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [['user', 'post'], ['user', 'review'], ['user', 'news']]

    def __str__(self):
        return f"{self.user} bookmarked something"



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
    pub_date = models.DateTimeField(db_index=True)
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


class WorkspaceState(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='workspace_states'
    )
    organisation = models.ForeignKey(
        'core.Organisation',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='workspace_states'
    )
    key = models.CharField(max_length=255)
    data = models.JSONField(default=dict)
    # Monotonically incremented on every successful write. Clients send the version they loaded
    # and the server rejects the write (409) if it has moved on — otherwise two members editing
    # the same shared board simultaneously silently clobber each other (last-write-wins).
    version = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=['key', 'user'],
                name='unique_user_workspace_state',
                condition=models.Q(user__isnull=False)
            ),
            models.UniqueConstraint(
                fields=['key', 'organisation'],
                name='unique_organisation_workspace_state',
                condition=models.Q(organisation__isnull=False)
            ),
        ]

    def __str__(self):
        owner = f"User: {self.user.username}" if self.user else f"Org: {self.organisation.name}" if self.organisation else "System"
        return f"State: {self.key} ({owner})"
