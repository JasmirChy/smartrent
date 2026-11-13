import os
import mimetypes
from django.conf import settings
from django.db import connection
from django.http import HttpResponse, Http404, FileResponse
from django.core.files.storage import FileSystemStorage

METADATA_JSON_FILES = [
    'profile_banners/banners_metadata.json',
    'payment_qr/qr_metadata.json',
    'fine_proofs/fine_evidence_metadata.json',
]

_table_initialized = False
_initial_restore_done = False


def normalize_rel_path(path_str):
    if not path_str:
        return ''
    clean = str(path_str).replace('\\', '/').lstrip('/')
    if clean.startswith('media/'):
        clean = clean[len('media/'):]
    return clean


def ensure_media_table():
    """Creates the persistent media table in PostgreSQL/SQLite if it does not exist yet."""
    global _table_initialized
    if _table_initialized:
        return
    try:
        with connection.cursor() as cursor:
            vendor = connection.vendor
            if vendor == 'postgresql':
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS smartrent_media_store (
                        file_path VARCHAR(500) PRIMARY KEY,
                        file_bytes BYTEA NOT NULL,
                        content_type VARCHAR(120) DEFAULT 'application/octet-stream',
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
            else:
                cursor.execute(
                    """
                    CREATE TABLE IF NOT EXISTS smartrent_media_store (
                        file_path VARCHAR(500) PRIMARY KEY,
                        file_bytes BLOB NOT NULL,
                        content_type VARCHAR(120) DEFAULT 'application/octet-stream',
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    );
                    """
                )
        _table_initialized = True
    except Exception as e:
        print(f"[SmartRent Persistent Media Table Notice]: {e}")


def save_file_to_db(rel_path, raw_bytes):
    """Upserts a file's binary content into the database."""
    rel_path = normalize_rel_path(rel_path)
    if not rel_path or raw_bytes is None:
        return
    ensure_media_table()
    content_type, _ = mimetypes.guess_type(rel_path)
    content_type = content_type or 'application/octet-stream'

    try:
        with connection.cursor() as cursor:
            if connection.vendor == 'postgresql':
                cursor.execute(
                    """
                    INSERT INTO smartrent_media_store (file_path, file_bytes, content_type, updated_at)
                    VALUES (%s, %s, %s, CURRENT_TIMESTAMP)
                    ON CONFLICT (file_path) DO UPDATE
                    SET file_bytes = EXCLUDED.file_bytes,
                        content_type = EXCLUDED.content_type,
                        updated_at = CURRENT_TIMESTAMP;
                    """,
                    [rel_path, raw_bytes, content_type],
                )
            else:
                cursor.execute(
                    """
                    INSERT OR REPLACE INTO smartrent_media_store (file_path, file_bytes, content_type, updated_at)
                    VALUES (%s, %s, %s, CURRENT_TIMESTAMP);
                    """,
                    [rel_path, raw_bytes, content_type],
                )
    except Exception as e:
        print(f"[SmartRent Persistent Media Save Notice]: {e}")


def delete_file_from_db(rel_path):
    rel_path = normalize_rel_path(rel_path)
    if not rel_path:
        return
    ensure_media_table()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "DELETE FROM smartrent_media_store WHERE file_path = %s;",
                [rel_path],
            )
    except Exception as e:
        print(f"[SmartRent Persistent Media Delete Notice]: {e}")


def restore_file_from_db(rel_path):
    """
    If a file is missing from Render's local /media/ disk after sleep,
    fetches it from PostgreSQL and writes it back to settings.MEDIA_ROOT.
    """
    rel_path = normalize_rel_path(rel_path)
    if not rel_path:
        return None, None
    ensure_media_table()
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT file_bytes, content_type FROM smartrent_media_store WHERE file_path = %s;",
                [rel_path],
            )
            row = cursor.fetchone()
            if not row:
                return None, None
            raw_bytes = bytes(row[0]) if row[0] is not None else None
            content_type = row[1] or 'application/octet-stream'

            if raw_bytes is not None:
                abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)
                os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                with open(abs_path, 'wb') as f:
                    f.write(raw_bytes)
                return raw_bytes, content_type
    except Exception as e:
        print(f"[SmartRent Persistent Media Restore Notice]: {e}")
    return None, None


def sync_metadata_jsons_to_db():
    """Backs up cover banner, QR code, and fine evidence JSON metadata files to PostgreSQL."""
    for rel_json in METADATA_JSON_FILES:
        abs_json = os.path.join(settings.MEDIA_ROOT, rel_json)
        if os.path.exists(abs_json):
            try:
                with open(abs_json, 'rb') as f:
                    save_file_to_db(rel_json, f.read())
            except Exception:
                pass


def restore_all_media_from_db():
    """
    Restores all saved images and JSON metadata files from PostgreSQL to MEDIA_ROOT
    when Render wakes up from sleep, and backs up any existing local files into PostgreSQL.
    """
    global _initial_restore_done
    if _initial_restore_done:
        return
    ensure_media_table()
    try:
        # 1. Restore any files stored in DB that are missing on local disk
        with connection.cursor() as cursor:
            cursor.execute("SELECT file_path, file_bytes FROM smartrent_media_store;")
            rows = cursor.fetchall()
            for file_path, file_bytes in rows:
                if not file_path or file_bytes is None:
                    continue
                abs_path = os.path.join(settings.MEDIA_ROOT, file_path)
                if not os.path.exists(abs_path):
                    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
                    with open(abs_path, 'wb') as f:
                        f.write(bytes(file_bytes))

        # 2. Back up any existing local /media/ files into DB if not yet stored
        if os.path.exists(settings.MEDIA_ROOT):
            for root, _, files in os.walk(settings.MEDIA_ROOT):
                for fname in files:
                    abs_p = os.path.join(root, fname)
                    rel_p = normalize_rel_path(os.path.relpath(abs_p, settings.MEDIA_ROOT))
                    try:
                        with open(abs_p, 'rb') as f:
                            save_file_to_db(rel_p, f.read())
                    except Exception:
                        pass

        _initial_restore_done = True
    except Exception as e:
        print(f"[SmartRent Startup Media Sync Notice]: {e}")


# ============================================================================
# HOOK DJANGO'S DEFAULT FILESYSTEM STORAGE AUTOMATICALLY
# ============================================================================
_orig_save = FileSystemStorage._save
_orig_exists = FileSystemStorage.exists
_orig_delete = FileSystemStorage.delete


def _persistent_save(self, name, content):
    saved_name = _orig_save(self, name, content)
    try:
        abs_path = self.path(saved_name)
        if os.path.exists(abs_path):
            with open(abs_path, 'rb') as f:
                save_file_to_db(saved_name, f.read())
        sync_metadata_jsons_to_db()
    except Exception as e:
        print(f"[SmartRent Storage Hook Save Notice]: {e}")
    return saved_name


def _persistent_exists(self, name):
    restore_all_media_from_db()
    if _orig_exists(self, name):
        sync_metadata_jsons_to_db()
        return True
    raw_bytes, _ = restore_file_from_db(name)
    return raw_bytes is not None


def _persistent_delete(self, name):
    try:
        _orig_delete(self, name)
    except Exception:
        pass
    delete_file_from_db(name)
    sync_metadata_jsons_to_db()


FileSystemStorage._save = _persistent_save
FileSystemStorage.exists = _persistent_exists
FileSystemStorage.delete = _persistent_delete


def serve_persistent_media(request, path):
    """
    Serves /media/<path> from disk if present, or restores it on-the-fly
    from PostgreSQL if Render wiped the container disk during sleep.
    """
    restore_all_media_from_db()
    sync_metadata_jsons_to_db()

    rel_path = normalize_rel_path(path)
    abs_path = os.path.join(settings.MEDIA_ROOT, rel_path)

    if os.path.exists(abs_path) and os.path.isfile(abs_path):
        content_type, _ = mimetypes.guess_type(abs_path)
        response = FileResponse(open(abs_path, 'rb'), content_type=content_type or 'application/octet-stream')
        response['Cache-Control'] = 'public, max-age=86400'
        return response

    raw_bytes, content_type = restore_file_from_db(rel_path)
    if raw_bytes is not None:
        response = HttpResponse(raw_bytes, content_type=content_type or 'application/octet-stream')
        response['Cache-Control'] = 'public, max-age=86400'
        return response

    raise Http404("Media file not found.")