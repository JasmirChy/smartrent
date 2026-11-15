import os
from datetime import date
from django.db.models.signals import pre_save, post_save
from django.dispatch import receiver
from django.utils import timezone
from .models import MonthlyBill


def get_first_day_of_last_month(today_date=None):
    """
    Returns the 1st day of the previous calendar month.
    Example: If today is Nov 15, 2026 -> returns Oct 1, 2026.
    Any bill from Sept 2026 or earlier is older than 2 months (present + last month).
    """
    today = today_date or timezone.localdate()
    if today.month == 1:
        return date(today.year - 1, 12, 1)
    return date(today.year, today.month - 1, 1)


def _get_meter_photo_field_names():
    """Finds the meter photo ImageField/FileField name(s) on MonthlyBill."""
    field_names = []
    for f in MonthlyBill._meta.fields:
        fname = f.name.lower()
        if 'meter' in fname and any(k in fname for k in ('photo', 'image', 'proof')):
            field_names.append(f.name)
    return field_names


def _delete_file_from_storage(file_field):
    """Safely removes the physical image file from disk/storage."""
    if not file_field or not getattr(file_field, 'name', None):
        return False
    try:
        storage = file_field.storage
        file_name = file_field.name
        if storage.exists(file_name):
            storage.delete(file_name)
        return True
    except Exception as exc:
        print(f"[SmartRent Storage Cleanup Warning]: {exc}")
        return False


def cleanup_old_meter_photos():
    """
    Retains meter photos ONLY for the present month and last month
    (at most the 2 most recent bills per room AND within the 2-month cutoff).
    Deletes older physical meter image files from disk and clears the DB column
    without altering kWh readings or bill totals.
    """
    meter_fields = _get_meter_photo_field_names()
    if not meter_fields:
        return 0

    cutoff_date = get_first_day_of_last_month()
    purged_count = 0

    # Group bills by room (newest first) so each room keeps at most 2 recent meter photos
    all_bills = MonthlyBill.objects.all().order_by(
        'room_id', '-cycle_end_date', '-due_date', '-id'
    )

    room_bill_Position = {}
    for bill in all_bills:
        room_key = bill.room_id or f"tenant_{bill.tenant_id}"
        room_bill_Position[room_key] = room_bill_Position.get(room_key, 0) + 1
        rank_in_room = room_bill_Position[room_key]

        # Determine the bill's reference date
        bill_ref_date = (
            getattr(bill, 'cycle_end_date', None)
            or getattr(bill, 'due_date', None)
            or (bill.created_at.date() if getattr(bill, 'created_at', None) else None)
        )

        # A bill is expired if it's older than the 2 most recent bills for that room
        # OR its billing date is before the 1st day of last month
        is_older_than_two_months = (rank_in_room > 2) or (
            bill_ref_date is not None and bill_ref_date < cutoff_date
        )

        if not is_older_than_two_months:
            continue

        updates = {}
        for field_name in meter_fields:
            file_field = getattr(bill, field_name, None)
            if file_field and getattr(file_field, 'name', ''):
                _delete_file_from_storage(file_field)
                updates[field_name] = ''

        if updates:
            # Update only the file column in SQL so historical bill amounts stay untouched
            MonthlyBill.objects.filter(pk=bill.pk).update(**updates)
            purged_count += 1

    return purged_count


@receiver(pre_save, sender=MonthlyBill)
def delete_replaced_meter_photo_on_resubmit(sender, instance, **kwargs):
    """
    If a tenant re-uploads a new meter photo on an existing bill,
    delete the previous file from disk immediately so orphan files never accumulate.
    """
    if not instance.pk:
        return

    meter_fields = _get_meter_photo_field_names()
    if not meter_fields:
        return

    try:
        old_bill = MonthlyBill.objects.get(pk=instance.pk)
    except MonthlyBill.DoesNotExist:
        return

    for field_name in meter_fields:
        old_file = getattr(old_bill, field_name, None)
        new_file = getattr(instance, field_name, None)
        if old_file and getattr(old_file, 'name', '') and old_file != new_file:
            _delete_file_from_storage(old_file)


@receiver(post_save, sender=MonthlyBill)
def auto_purge_meter_photos_after_bill_save(sender, instance, **kwargs):
    """
    Automatically enforces the 2-month meter photo limit whenever a bill is created or updated.
    """
    try:
        cleanup_old_meter_photos()
    except Exception as exc:
        print(f"[SmartRent Auto Meter Photo Cleanup]: {exc}")