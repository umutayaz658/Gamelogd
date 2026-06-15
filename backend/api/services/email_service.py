import threading
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from django.utils.html import strip_tags
from django.conf import settings


def _send_email_in_background(msg):
    """
    Internal helper: sends an EmailMultiAlternatives in a background thread
    so HTTP responses are never blocked by slow/hanging SMTP connections.
    """
    try:
        msg.send()
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send email to {msg.to}: {e}")


def send_verification_email(email, code):
    """
    Sends the 6-digit email verification code (OTP) to the user.
    Email is sent asynchronously so the API response is not blocked.
    """
    subject = 'Gamelogd - Email Verification Code'
    html_content = render_to_string('emails/verification_email.html', {'code': code})
    text_content = strip_tags(html_content)

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Gamelogd <noreply@gamelogd.net>')
    msg = EmailMultiAlternatives(subject, text_content, from_email, [email])
    msg.attach_alternative(html_content, "text/html")

    thread = threading.Thread(target=_send_email_in_background, args=(msg,), daemon=True)
    thread.start()


def send_support_ticket_email(ticket, user):
    """
    Sends a support ticket or bug report submission to the support team.
    Email is sent asynchronously so the API response is not blocked.
    """
    is_bug = ticket.ticket_type == 'bug'

    if is_bug:
        subject = f"New Bug Report: {ticket.subject}"
    else:
        subject = f"New Support Ticket: {ticket.subject}"

    html_content = render_to_string('emails/support_ticket_email.html', {
        'ticket': ticket,
        'user': user,
        'is_bug': is_bug
    })
    text_content = strip_tags(html_content)

    from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', 'Gamelogd <noreply@gamelogd.net>')
    support_recipient = getattr(settings, 'SUPPORT_EMAIL', 'support@gamelogd.net')

    msg = EmailMultiAlternatives(subject, text_content, from_email, [support_recipient])
    msg.attach_alternative(html_content, "text/html")

    thread = threading.Thread(target=_send_email_in_background, args=(msg,), daemon=True)
    thread.start()
