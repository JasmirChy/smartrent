from django.core.management.base import BaseCommand
from apps.billing.tasks import dispatch_due_rent_email_reminders


class Command(BaseCommand):
    help = "Sends automated monthly rent & meter reading reminder emails based on tenant entry_date."

    def handle(self, *args, **options):
        sent = dispatch_due_rent_email_reminders()
        self.stdout.write(
            self.style.SUCCESS(f"Dispatched {sent} monthly anniversary rent reminder email(s).")
        )