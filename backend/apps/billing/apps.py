from django.apps import AppConfig


class BillingConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.billing'

    def ready(self):
        # Register automatic 2-month meter photo retention signals
        from . import storage_cleanup  # noqa: F401