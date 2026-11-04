import calendar
from datetime import date, timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import MonthlyBill


def add_one_month(orig_date):
    year = orig_date.year
    month = orig_date.month + 1
    if month > 12:
        month = 1
        year += 1
    max_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(orig_date.day, max_day))


def create_next_cycle_bill(completed_bill):
    """
    Automatically creates the next month's bill cycle after a bill is paid/approved,
    locking the approved current_meter_reading as next month's previous_meter_reading.
    """
    tenancy = completed_bill.tenancy
    if not tenancy.is_active:
        return None

    next_start = completed_bill.cycle_end_date
    next_end = add_one_month(next_start)
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


def dispatch_due_rent_email_reminders():
    """
    Finds all unpaid bills whose monthly due date (based on entry_date) is today or within 3 days,
    and emails the tenant their reminder to submit their new meter reading and payment.
    """
    today = timezone.localdate()
    upcoming_window = today + timedelta(days=3)

    due_bills = MonthlyBill.objects.filter(
        status='UNPAID',
        due_date__lte=upcoming_window,
        reminder_email_sent=False,
    ).select_related('tenant', 'room', 'tenancy')

    sent_count = 0
    for bill in due_bills:
        subject = f"SmartRent - Monthly Rent & Meter Reading Reminder (Room {bill.room.room_number})"
        message = (
            f"Namaste {bill.tenant.full_name},\n\n"
            f"Your monthly rental cycle for Room {bill.room.room_number} (Entry Date: {bill.tenancy.entry_date}) "
            f"is due on {bill.due_date}.\n\n"
            f"Fixed Breakdown:\n"
            f"• Base Room Rent: Rs. {bill.base_rent}\n"
            f"• Fixed Water Bill: Rs. {bill.water_bill}\n"
            f"• Previous Electricity Meter Reading: {bill.previous_meter_reading} units\n"
            f"• Electricity Rate: Rs. {bill.electricity_rate} per unit\n"
            f"• Any Property Damage Fine: Rs. {bill.damage_fine_amount}\n\n"
            f"Please log in to your SmartRent Tenant Dashboard, enter your current electricity meter reading, "
            f"and upload your meter photo and payment screenshot (or pay cash directly to Admin).\n\n"
            f"— SmartRent House Management"
        )
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[bill.tenant.email],
            fail_silently=True,
        )
        bill.reminder_email_sent = True
        bill.save(update_fields=['reminder_email_sent'])
        sent_count += 1

    return sent_count