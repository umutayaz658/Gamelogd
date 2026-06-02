from core.models import Game, Post, PostMedia
from api.models import User

# 1. Clear broken user avatars & covers
users = User.objects.exclude(avatar="") | User.objects.exclude(cover_image="")
user_fixes = 0
for u in users:
    changed = False
    if u.avatar and not str(u.avatar).startswith("http"):
        u.avatar = None
        changed = True
    if u.cover_image and not str(u.cover_image).startswith("http"):
        u.cover_image = None
        changed = True
    if changed:
        u.save(update_fields=['avatar', 'cover_image'])
        user_fixes += 1

print(f"Fixed {user_fixes} users.")

# 2. Clear broken post media
post_media = PostMedia.objects.all()
media_fixes = 0
for pm in post_media:
    if pm.file and not str(pm.file).startswith("http"):
        pm.delete()  # If the file is gone, the media object is useless
        media_fixes += 1

print(f"Deleted {media_fixes} broken post media.")

