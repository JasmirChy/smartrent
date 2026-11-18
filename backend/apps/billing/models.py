from decimal import Decimal
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from apps.rooms.models import Room, Tenancy


class MonthlyBill(models.Model):
    STATUS_CHOICES = (
        ('UNPAID', 'Unpaid / Awaiting Meter Reading'),
        ('PENDING_VERIFICATION', 'Pending Admin Verification'),
        ('APPROVED', 'Approved & Paid'),
        ('PAID_CASH', 'Paid via Cash (Admin Verified)'),
        ('REJECTED', 'Rejected - Re-upload Required'),
    )
    PAYMENT_METHOD_CHOICES = (
        ('ONLINE', 'Online (eSewa / Khalti / Bank / QR)'),
        ('CASH', 'Cash to Admin'),
    )

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name='bills')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='bills')
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bills'
    )

    billing_month_label = models.CharField(max_length=50, help_text="e.g., November 2026")
    cycle_start_date = models.DateField()
    cycle_end_date = models.DateField()
    due_date = models.DateField()

    # Core Pricing Components
    base_rent = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('3800.00'))
    water_bill = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('100.00'))
    electricity_rate = models.DecimalField(max_digits=6, decimal_places=2, default=Decimal('15.00'))

    months_due = models.IntegerField(default=1, help_text="Admin can increase this if tenant missed previous months")
    water_discount = models.DecimalField(max_digits=8, decimal_places=2, default=Decimal('0.00'), help_text="Admin override deduction for water")
   
    # Electricity Meter Readings
    previous_meter_reading = models.DecimalField(max_digits=10, decimal_places=2)
    current_meter_reading = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    units_consumed = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    electricity_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Property Damage / Rule Violation Fines
    damage_fine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))
    damage_fine_reason = models.CharField(max_length=255, blank=True)

    # Auto-Calculated Total
    total_payable = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal('0.00'))

    # Zone 1 & Zone 2 Image Proofs + Transaction Info
    meter_photo_proof = models.ImageField(upload_to='meter_proofs/', null=True, blank=True)
    payment_screenshot_proof = models.ImageField(upload_to='payment_proofs/', null=True, blank=True)
    transaction_reference = models.CharField(max_length=100, blank=True)

    payment_method = models.CharField(max_length=10, choices=PAYMENT_METHOD_CHOICES, default='ONLINE')
    status = models.CharField(max_length=25, choices=STATUS_CHOICES, default='UNPAID')
    admin_remarks = models.TextField(blank=True)

    reminder_email_sent = models.BooleanField(default=False)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-cycle_end_date', '-created_at']

    def clean(self):
        if self.current_meter_reading is not None:
            if self.current_meter_reading < self.previous_meter_reading:
                raise ValidationError(
                    "New electricity meter reading cannot be less than previous reading."
                )

    def calculate_totals(self):
        """Calculates units consumed, multiplies rent/water by months_due, and applies discount."""
        base_rate = Decimal(str(self.base_rent or 0))
        water_rate = Decimal(str(self.water_bill or 100))
        discount = Decimal(str(self.water_discount or 0))
        m_due = Decimal(str(self.months_due or 1))
        
        elec_rate = Decimal(str(self.electricity_rate or 15))
        fine = Decimal(str(self.damage_fine_amount or 0))
        prev_reading = Decimal(str(self.previous_meter_reading or 0))

        if self.current_meter_reading is not None:
            curr_reading = Decimal(str(self.current_meter_reading))
            units = max(Decimal('0.00'), curr_reading - prev_reading)
        else:
            units = Decimal('0.00')

        self.units_consumed = units
        self.electricity_amount = units * elec_rate
        
        # Multiply fixed costs by missed months, then subtract water discount
        total_rent = base_rate * m_due
        total_water = max(Decimal('0.00'), (water_rate * m_due) - discount)

        self.total_payable = total_rent + total_water + self.electricity_amount + fine

    def save(self, *args, **kwargs):
        self.calculate_totals()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Room {self.room.room_number} - {self.billing_month_label} | Rs. {self.total_payable} ({self.status})"


class HouseExpense(models.Model):
    """Admin expense logger for whole-house electricity, water supply, and maintenance."""
    CATEGORY_CHOICES = (
        ('ELECTRICITY_MAIN', 'Main House Electricity Bill (NEA)'),
        ('WATER_SUPPLY', 'Whole House Water Bill / Tanker'),
        ('MAINTENANCE', 'Plumbing, Electrical & Building Repairs'),
        ('CLEANING_SANITATION', 'Waste Disposal & Cleaning'),
        ('INTERNET_OTHER', 'Internet / Other Overheads'),
    )

    category = models.CharField(max_length=30, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=150)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    expense_date = models.DateField()
    receipt_image = models.ImageField(upload_to='expenses/', null=True, blank=True)
    notes = models.TextField(blank=True)
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_expenses'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-expense_date', '-created_at']

    def __str__(self):
        return f"{self.title} - Rs. {self.amount} ({self.expense_date})"