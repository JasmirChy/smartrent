import calendar
from datetime import date, timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
import nepali_datetime
from .models import MonthlyBill


def add_one_month(orig_date, anchor_bs_day=None):
    """
    Advances by 1 Bikram Sambat (BS) month while keeping the due day locked
    to `anchor_bs_day` (clamping only if the target BS month has fewer days),
    then returns the corresponding Gregorian (AD) date.
    """
    bs_curr = nepali_datetime.date.from_datetime_date(orig_date)
    target_day = anchor_bs_day if anchor_bs_day is not None else bs_curr.day

    next_year = bs_curr.year
    next_month = bs_curr.month + 1
    if next_month > 12:
        next_month = 1
        next_year += 1

    # Find the last valid day in the target BS month (BS months can have 29-32 days)
    clamped_day = min(target_day, 32)
    while clamped_day >= 28:
        try:
            next_bs = nepali_datetime.date(next_year, next_month, clamped_day)
            return next_bs.to_datetime_date()
        except ValueError:
            clamped_day -= 1

    return nepali_datetime.date(next_year, next_month, 1).to_datetime_date()


def create_next_cycle_bill(completed_bill):
    """
    Automatically creates the next month's bill cycle after a bill is paid/approved,
    locking the approved current_meter_reading as next month's previous_meter_reading
    and keeping the BS due day anchored.
    """
    tenancy = completed_bill.tenancy
    if not tenancy.is_active:
        return None

    anchor_bs_day = None
    if tenancy.entry_date:
        anchor_bs_day = nepali_datetime.date.from_datetime_date(tenancy.entry_date).day

    next_start = completed_bill.cycle_end_date
    next_end = add_one_month(next_start, anchor_bs_day=anchor_bs_day)
    next_label = next_end.strftime("%B %Y")

    # Prevent duplicate creation if next cycle already exists
    existing = MonthlyBill.objects.filter(
        tenancy=tenancy,
        cycle_start_date=next_start,
    ).first()
    if existing:
        return existing

    new_prev_reading = (
        completed_bill.current_meter_reading
        if completed_bill.current_meter_reading is not None
        else completed_bill.previous_meter_reading
    )

    return MonthlyBill.objects.create(
        tenancy=tenancy,
        room=completed_bill.room,
        tenant=completed_bill.tenant,
        billing_month_label=next_label,
        cycle_start_date=next_start,
        cycle_end_date=next_end,
        due_date=next_end,
        base_rent=completed_bill.room.base_rent,
        water_bill=completed_bill.room.fixed_water_bill,
        electricity_rate=completed_bill.room.electricity_rate_per_unit,
        previous_meter_reading=new_prev_reading,
        status='UNPAID',
    )


def dispatch_due_rent_email_reminders(force=False):
    """
    Finds all unpaid bills whose monthly due date is today or within 3 days,
    and emails the tenant their reminder via webhook/SMTP.
    """
    from .views import send_billing_notification_email, _get_bill_email_breakdown

    today = timezone.localdate()
    upcoming_window = today + timedelta(days=3)

    filters = {
        'status': 'UNPAID',
        'due_date__lte': upcoming_window,
    }
    if not force:
        filters['reminder_email_sent'] = False

    due_bills = MonthlyBill.objects.filter(**filters).select_related('tenant', 'room', 'tenancy')

    sent_count = 0
    tenant_names = []
    for bill in due_bills:
        rent_total, water_total, rent_note, water_note = _get_bill_email_breakdown(bill)
        subject = f"SmartRent - Monthly Rent & Meter Reading Reminder (Room {bill.room.room_number})"
        message = (
            f"Namaste {bill.tenant.full_name},\n\n"
            f"Your monthly rental cycle for Room {bill.room.room_number} (Entry Date: {bill.tenancy.entry_date}) "
            f"is due on {bill.due_date}.\n\n"
            f"Fixed Breakdown:\n"
            f"• Base Room Rent{rent_note}: Rs. {rent_total}\n"
            f"• Fixed Water Bill{water_note}: Rs. {water_total}\n"
            f"• Previous Electricity Meter Reading: {bill.previous_meter_reading} units\n"
            f"• Electricity Rate: Rs. {bill.electricity_rate} per unit\n"
            f"• Any Property Damage Fine: Rs. {bill.damage_fine_amount}\n\n"
            f"Please log in to your SmartRent Tenant Dashboard, enter your current electricity meter reading, "
            f"and upload your meter photo and payment screenshot (or pay cash directly to Admin).\n\n"
            f"— SmartRent House Management"
        )
        send_billing_notification_email(
            recipient_email=bill.tenant.email,
            subject=subject,
            message_body=message,
        )
        if not bill.reminder_email_sent:
            bill.reminder_email_sent = True
            bill.save(update_fields=['reminder_email_sent'])
        sent_count += 1
        tenant_names.append(bill.tenant.full_name)

    return sent_count, tenant_names