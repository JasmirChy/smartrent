from django.db import models
from django.conf import settings
from django.utils import timezone
import nepali_datetime


def _build_bs_date_clamped(bs_year, bs_month, desired_day):
    """Creates a nepali_datetime.date clamped to the last valid day of that BS month."""
    clamped_day = min(desired_day, 32)
    while clamped_day >= 28:
        try:
            return nepali_datetime.date(bs_year, bs_month, clamped_day)
        except ValueError:
            clamped_day -= 1
    return nepali_datetime.date(bs_year, bs_month, 1)


class Room(models.Model):
    FLOOR_CHOICES = (
        ('GROUND', 'Ground Floor'),
        ('FIRST', 'First Floor'),
    )
    TYPE_CHOICES = (
        ('STANDARD', 'Standard Room (Rs. 3,800)'),
        ('SMALL', 'Small / Compact Room (Rs. 2,500)'),
    )

    room_number = models.CharField(max_length=10, unique=True)  # e.g., A1, A2, A3, A4, B1..B5
    floor = models.CharField(max_length=10, choices=FLOOR_CHOICES)
    room_type = models.CharField(max_length=15, choices=TYPE_CHOICES, default='STANDARD')
    title = models.CharField(max_length=100, default='Standard Deluxe Room')
    area_sqft = models.PositiveIntegerField(default=130)
    features = models.JSONField(default=list, blank=True)  # List of bullet features for landing cards

    base_rent = models.DecimalField(max_digits=10, decimal_places=2, default=3800.00)
    fixed_water_bill = models.DecimalField(max_digits=8, decimal_places=2, default=100.00)
    electricity_rate_per_unit = models.DecimalField(max_digits=6, decimal_places=2, default=15.00)

    current_meter_reading = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    is_occupied = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['room_number']

    def save(self, *args, **kwargs):
        # Always keep floor synced with room_number prefix (A -> GROUND, B -> FIRST)
        if self.room_number:
            prefix = self.room_number.strip().upper()[0]
            if prefix == 'A':
                self.floor = 'GROUND'
            elif prefix == 'B':
                self.floor = 'FIRST'
        super().save(*args, **kwargs)

    def __str__(self):
        status = "Occupied" if self.is_occupied else "Available"
        return f"Room {self.room_number} ({self.get_floor_display()}) - Rs. {self.base_rent} [{status}]"


class RoomImage(models.Model):
    """Stores up to 2 photos per room (max 200 KB each) uploaded by Admin."""
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='room_photos/')
    caption = models.CharField(max_length=100, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']

    def __str__(self):
        return f"Room {self.room.room_number} Photo #{self.id}"

class Tenancy(models.Model):
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='tenancies')
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='tenancies'
    )
    entry_date = models.DateField(help_text="Date tenant moved in; determines monthly billing date")
    starting_meter_reading = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        help_text="Initial electricity meter reading set by Admin at move-in"
    )
    is_active = models.BooleanField(default=True)
    move_out_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_active', '-entry_date']

    @property
    def billing_day(self):
        return nepali_datetime.date.from_datetime_date(self.entry_date).day

    def get_next_due_date(self):
        """Calculates the exact upcoming monthly billing date anchored to the BS day of entry_date."""
        today_ad = timezone.localdate()
        today_bs = nepali_datetime.date.from_datetime_date(today_ad)
        anchor_bs_day = nepali_datetime.date.from_datetime_date(self.entry_date).day

        bs_year, bs_month = today_bs.year, today_bs.month
        candidate_bs = _build_bs_date_clamped(bs_year, bs_month, anchor_bs_day)

        if candidate_bs < today_bs:
            bs_month += 1
            if bs_month > 12:
                bs_month = 1
                bs_year += 1
            candidate_bs = _build_bs_date_clamped(bs_year, bs_month, anchor_bs_day)

        return candidate_bs.to_datetime_date()

    def __str__(self):
        return f"{self.tenant.full_name} -> Room {self.room.room_number} (Entry: {self.entry_date})"


class HeroBanner(models.Model):
    """Admin-managed responsive homepage image viewer."""
    title = models.CharField(max_length=120, default="Smart House Rental & Utility Living")
    subtitle = models.CharField(max_length=255, blank=True)
    badge_text = models.CharField(max_length=80, default="Physical Inspection Passed")
    image = models.ImageField(upload_to='hero_banners/')
    is_active = models.BooleanField(default=True)
    display_order = models.PositiveIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['display_order', '-created_at']

    def __str__(self):
        return f"Hero Banner #{self.id}: {self.title}"


class HouseRule(models.Model):
    """Strict rules for cleanliness, discipline, and property damage fines."""
    CATEGORY_CHOICES = (
        ('CLEANLINESS', 'Cleanliness & Waste Segregation'),
        ('DISCIPLINE', 'Discipline & Quiet Hours'),
        ('DAMAGE_FINE', 'Property Damage & Fine Schedule'),
    )

    category = models.CharField(max_length=20, choices=CATEGORY_CHOICES)
    title = models.CharField(max_length=150)
    description = models.TextField()
    fine_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    display_order = models.PositiveIntegerField(default=1)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'display_order']

    def __str__(self):
        return f"[{self.get_category_display()}] {self.title}"


class RoomReservation(models.Model):
    """Handles room reservation and physical inspection requests from users before Tenancy is created."""
    STATUS_CHOICES = (
        ('PENDING', 'Pending Review'),
        ('APPROVED', 'Approved & Assigned'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled by User'),
    )
    REQUEST_TYPE_CHOICES = (
        ('RESERVE', 'Instant Room Reservation'),
        ('VISIT', 'Schedule Physical Inspection / Visit'),
    )

    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='reservations')
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reservations'
    )
    request_type = models.CharField(max_length=15, choices=REQUEST_TYPE_CHOICES, default='RESERVE')
    expected_move_in_date = models.DateField(help_text="Proposed entry date for billing cycle")
    occupants_count = models.PositiveSmallIntegerField(default=1)
    phone_number = models.CharField(max_length=20, blank=True)
    occupation = models.CharField(max_length=100, blank=True)
    message = models.TextField(blank=True, help_text="Any notes or preferred visit time")

    token_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    payment_screenshot = models.ImageField(upload_to='reservation_tokens/', null=True, blank=True)
    citizenship_document = models.ImageField(upload_to='kyc_documents/', null=True, blank=True)

    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    admin_remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.user.email} -> Room {self.room.room_number} [{self.status}]"


class MoveOutRequest(models.Model):
    """Item B: Handles tenant move-out & final meter settlement requests."""
    STATUS_CHOICES = (
        ('PENDING', 'Pending Final Settlement'),
        ('APPROVED', 'Approved & Room Vacated'),
        ('REJECTED', 'Rejected'),
    )

    tenancy = models.ForeignKey(Tenancy, on_delete=models.CASCADE, related_name='move_out_requests')
    room = models.ForeignKey(Room, on_delete=models.CASCADE, related_name='move_out_requests')
    tenant = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='move_out_requests'
    )
    requested_date = models.DateField()
    reason = models.TextField(blank=True)
    final_meter_reading = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=15, choices=STATUS_CHOICES, default='PENDING')
    admin_remarks = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Move-Out: Room {self.room.room_number} ({self.tenant.full_name}) [{self.status}]"