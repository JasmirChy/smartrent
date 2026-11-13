from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from .persistent_media import (
    serve_persistent_media,
    restore_all_media_from_db,
    sync_metadata_jsons_to_db,
)


def health_check(request):
    restore_all_media_from_db()
    sync_metadata_jsons_to_db()
    return JsonResponse({"status": "ok", "service": "SmartRent API"})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/health/', health_check, name='health_check'),
    path('api/accounts/', include('apps.accounts.urls')),
    path('api/rooms/', include('apps.rooms.urls')),
    path('api/billing/', include('apps.billing.urls')),
    path('api/communication/', include('apps.communication.urls')),
    # Serve and auto-restore uploaded media files from PostgreSQL even after Render sleeps
    re_path(r'^media/(?P<path>.*)$', serve_persistent_media, name='serve_persistent_media'),
]

if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)