from decimal import Decimal
from django.core.management.base import BaseCommand
from apps.rooms.models import Room, HouseRule


class Command(BaseCommand):
    help = "Seeds Ground Floor (A1-A4) & Second Floor (B1-B5) rooms and strict House Rules."

    def handle(self, *args, **options):
        rooms_data = [
            # Ground Floor (A1, A2, A3 [Small], A4)
            {
                "room_number": "A1",
                "floor": "GROUND",
                "room_type": "STANDARD",
                "title": "Standard Deluxe Room",
                "area_sqft": 135,
                "base_rent": Decimal("3800.00"),
                "features": ["Ground Floor Access", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "A2",
                "floor": "GROUND",
                "room_type": "STANDARD",
                "title": "Standard Bright Room",
                "area_sqft": 140,
                "base_rent": Decimal("3800.00"),
                "features": ["Natural Ventilation", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "A3",
                "floor": "GROUND",
                "room_type": "SMALL",
                "title": "Compact Solo Studio",
                "area_sqft": 90,
                "base_rent": Decimal("2500.00"),
                "features": ["Compact Budget Room", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "A4",
                "floor": "GROUND",
                "room_type": "STANDARD",
                "title": "Garden View Standard Room",
                "area_sqft": 135,
                "base_rent": Decimal("3800.00"),
                "features": ["Quiet Corner Unit", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },

            # Second Floor (B1, B2, B3, B4 [Small], B5)
            {
                "room_number": "B1",
                "floor": "SECOND",
                "room_type": "STANDARD",
                "title": "Second Floor Corner Room",
                "area_sqft": 140,
                "base_rent": Decimal("3800.00"),
                "features": ["Terrace Access", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "B2",
                "floor": "SECOND",
                "room_type": "STANDARD",
                "title": "Balcony View Standard Room",
                "area_sqft": 135,
                "base_rent": Decimal("3800.00"),
                "features": ["South-Facing Sunlight", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "B3",
                "floor": "SECOND",
                "room_type": "STANDARD",
                "title": "East Wing Standard Room",
                "area_sqft": 135,
                "base_rent": Decimal("3800.00"),
                "features": ["Cross Ventilation", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "B4",
                "floor": "SECOND",
                "room_type": "SMALL",
                "title": "Compact Mini Studio",
                "area_sqft": 85,
                "base_rent": Decimal("2500.00"),
                "features": ["Compact Budget Room", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
            {
                "room_number": "B5",
                "floor": "SECOND",
                "room_type": "STANDARD",
                "title": "West Terrace Standard Room",
                "area_sqft": 130,
                "base_rent": Decimal("3800.00"),
                "features": ["Open Terrace Proximity", "24/7 Water Supply", "Dedicated Digital Sub-meter"],
            },
        ]

        for r in rooms_data:
            room, created = Room.objects.update_or_create(
                room_number=r["room_number"],
                defaults={
                    "floor": r["floor"],
                    "room_type": r["room_type"],
                    "title": r["title"],
                    "area_sqft": r["area_sqft"],
                    "base_rent": r["base_rent"],
                    "fixed_water_bill": Decimal("100.00"),
                    "electricity_rate_per_unit": Decimal("15.00"),
                    "features": r["features"],
                },
            )
            action = "Created" if created else "Updated"
            self.stdout.write(self.style.SUCCESS(f"{action} Room {room.room_number} -> Rs. {room.base_rent}"))

        rules_data = [
            {
                "category": "CLEANLINESS",
                "title": "Strict Daily Cleanliness & Waste Segregation",
                "description": (
                    "All tenants must keep corridors, shared bathrooms, staircases, and surroundings clean. "
                    "Garbage must be segregated and disposed of in designated bins daily."
                ),
                "fine_amount": Decimal("500.00"),
                "display_order": 1,
            },
            {
                "category": "DISCIPLINE",
                "title": "House Discipline, Quiet Hours & Entry Timing",
                "description": (
                    "Loud music, shouting, or disturbances are strictly prohibited after 10:00 PM. "
                    "All residents must maintain respectful behavior with neighbors and follow main gate security timings."
                ),
                "fine_amount": Decimal("1000.00"),
                "display_order": 2,
            },
            {
                "category": "DAMAGE_FINE",
                "title": "Property Damage & Electrical/Plumbing Fixture Policy",
                "description": (
                    "Any damage caused to room doors, windows, walls, switches, sub-meters, or plumbing fixtures "
                    "by a tenant will be fined at 100% of the actual replacement and repair cost on their monthly bill."
                ),
                "fine_amount": Decimal("0.00"),
                "display_order": 3,
            },
        ]

        for rule in rules_data:
            HouseRule.objects.update_or_create(
                title=rule["title"],
                defaults=rule,
            )

        self.stdout.write(self.style.SUCCESS("Successfully seeded all 9 rooms (A1-A4, B1-B5) and House Rules!"))