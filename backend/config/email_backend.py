import json
import urllib.request
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.mail.backends.smtp import EmailBackend as SmtpEmailBackend


class GoogleScriptWebhookEmailBackend(BaseEmailBackend):
    """
    Sends Django emails (OTPs, receipts, reminders) via your Google Apps Script
    HTTPS Web App URL (Port 443) so Render Free Tier never blocks SMTP Port 587.
    Automatically falls back to standard Gmail SMTP if the webhook fails.
    """

    def send_messages(self, email_messages):
        if not email_messages:
            return 0

        webhook_url = getattr(settings, 'GOOGLE_SCRIPT_WEBHOOK_URL', '').strip()
        webhook_secret = getattr(settings, 'GOOGLE_SCRIPT_SECRET', 'SMARTRENT_SECRET_2026').strip()

        sent_count = 0
        for message in email_messages:
            recipients = list(message.to or [])
            if not recipients:
                continue

            if webhook_url:
                try:
                    for recipient in recipients:
                        payload = json.dumps({
                            "secret": webhook_secret,
                            "to": recipient,
                            "subject": message.subject,
                            "message": message.body,
                        }).encode('utf-8')

                        req = urllib.request.Request(
                            webhook_url,
                            data=payload,
                            headers={'Content-Type': 'application/json'},
                            method='POST',
                        )
                        # Google Apps Script redirects on success; urllib follows it automatically
                        with urllib.request.urlopen(req, timeout=15) as response:
                            resp_text = response.read().decode('utf-8', errors='ignore')
                            if response.status in (200, 302) and 'Unauthorized' not in resp_text:
                                sent_count += 1
                                continue
                except Exception as exc:
                    if not self.fail_silently:
                        print(f"[SmartRent Email Webhook Warning]: {exc}")

            # Fallback to standard SMTP (e.g. on localhost if needed)
            try:
                smtp_backend = SmtpEmailBackend(fail_silently=self.fail_silently)
                sent_count += smtp_backend.send_messages([message])
            except Exception as smtp_exc:
                if not self.fail_silently:
                    raise smtp_exc

        return sent_count