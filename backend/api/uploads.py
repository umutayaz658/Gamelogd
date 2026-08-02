"""
Shared validation for user-supplied file uploads.

Every endpoint that accepts a file must size- and type-check it server-side; the multipart
`content_type` header is attacker-controlled, so the media kind is derived from the file
extension instead. Mirrors the limits MessageViewSet has always enforced (10MB + extension
allow-list) so all upload surfaces behave the same.
"""

from rest_framework.exceptions import ValidationError

IMAGE_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
VIDEO_EXTENSIONS = {'mp4', 'webm', 'mov', 'm4v'}

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10MB
MAX_POST_MEDIA_COUNT = 10


def validate_media_file(file, *, allow_video=False, max_bytes=MAX_UPLOAD_BYTES):
    """
    Validates size and extension; returns 'image' or 'video' for the caller to store.
    Raises DRF ValidationError (-> 400) on any violation.
    """
    if file.size > max_bytes:
        raise ValidationError(f"File size must be less than {max_bytes // (1024 * 1024)}MB.")

    name = file.name or ''
    ext = name.rsplit('.', 1)[-1].lower() if '.' in name else ''
    if ext in IMAGE_EXTENSIONS:
        return 'image'
    if allow_video and ext in VIDEO_EXTENSIONS:
        return 'video'

    allowed = sorted(IMAGE_EXTENSIONS | (VIDEO_EXTENSIONS if allow_video else set()))
    raise ValidationError(f"Unsupported file format. Allowed formats: {', '.join(allowed)}.")
