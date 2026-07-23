import threading
import requests as http_requests
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings


def _get_resend_api_key():
    """Get the Resend API key from Django settings."""
    return getattr(settings, 'EMAIL_HOST_PASSWORD', None)


def _send_via_resend_api(to_email, subject, html_content, text_content):
    """
    Send an email via Resend's HTTP API (port 443).
    This is more reliable than SMTP in cloud environments like Railway
    where outbound SMTP ports (465, 587) are often blocked.
    """
    api_key = _get_resend_api_key()
    use_console = getattr(settings, 'EMAIL_BACKEND', None) == 'django.core.mail.backends.console.EmailBackend'
    
    if not api_key or use_console:
        print(f"[EMAIL] Console backend or no API key. Printing email to console.")
        print(f"[EMAIL] To: {to_email} | Subject: {subject}")
        print(f"[EMAIL] Body: {text_content[:200]}...")
        return

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Gamelogd <noreply@gamelogd.net>')

    try:
        response = http_requests.post(
            'https://api.resend.com/emails',
            headers={
                'Authorization': f'Bearer {api_key}',
                'Content-Type': 'application/json',
            },
            json={
                'from': from_email,
                'to': [to_email],
                'subject': subject,
                'html': html_content,
                'text': text_content,
            },
            timeout=10,
        )

        if response.status_code in (200, 201):
            print(f"[EMAIL OK] Sent to {to_email} via Resend API (id: {response.json().get('id', 'N/A')})")
        else:
            print(f"[EMAIL ERROR] Resend API returned {response.status_code}: {response.text}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {to_email}: {e}")


def _send_email_async(to_email, subject, html_content, text_content):
    """Fire-and-forget email sending in a background thread."""
    thread = threading.Thread(
        target=_send_via_resend_api,
        args=(to_email, subject, html_content, text_content),
        daemon=True,
    )
    thread.start()


def send_verification_email(email, code):
    """
    Sends the 6-digit email verification code (OTP) to the user.
    Email is sent asynchronously via Resend HTTP API so the API response is not blocked.
    """
    subject = 'Gamelogd - Email Verification Code'
    html_content = render_to_string('emails/verification_email.html', {'code': code})
    text_content = strip_tags(html_content)
    _send_email_async(email, subject, html_content, text_content)


def send_email_change_verification_email(email, code):
    """
    Sends the 6-digit verification code (OTP) to the NEW address a user is trying to
    change their account email to. Sent asynchronously via Resend HTTP API.
    """
    subject = 'Gamelogd - Confirm Your New Email'
    html_content = render_to_string('emails/email_change_verification.html', {'code': code})
    text_content = strip_tags(html_content)
    _send_email_async(email, subject, html_content, text_content)


def send_support_ticket_email(ticket, user):
    """
    Sends a support ticket or bug report submission to the support team.
    Email is sent asynchronously via Resend HTTP API so the API response is not blocked.
    """
    is_bug = ticket.ticket_type == 'bug'

    if is_bug:
        subject = f"New Bug Report: {ticket.subject}"
    else:
        subject = f"New Support Ticket: {ticket.subject}"

    html_content = render_to_string('emails/support_ticket_email.html', {
        'ticket': ticket,
        'user': user,
        'is_bug': is_bug,
    })
    text_content = strip_tags(html_content)

    support_recipient = getattr(settings, 'SUPPORT_EMAIL', 'support@gamelogd.net')
    _send_email_async(support_recipient, subject, html_content, text_content)
