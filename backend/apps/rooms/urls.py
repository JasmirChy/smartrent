from django.urls import path
from .views import (
    PublicLandingDataView,
    RoomListUpdateView,
    AdminRoomDetailUpdateView,
    AdminAssignTenantToRoomView,
    AdminVacateRoomView,
    RoomReservationListCreateView,
    RoomReservationActionView,
    MoveOutStatusView,
    RequestMoveOutView,
    PendingMoveOutListView,
    ProcessMoveOutRequestView,
    HeroBannerListCreateView,
    HeroBannerDetailView,
    HouseRuleListCreateView,
    HouseRuleDetailView,
)

urlpatterns = [
    # 1. Public Homepage Landing Data (Rooms, Hero Banners, Rules, Notices)
    path('landing/', PublicLandingDataView.as_view(), name='public_landing_data'),

    # 2. Rooms Matrix & Admin Room Actions
    path('', RoomListUpdateView.as_view(), name='rooms_list'),
    path('<int:pk>/', AdminRoomDetailUpdateView.as_view(), name='admin_room_detail'),
    path('<int:room_id>/assign-tenant/', AdminAssignTenantToRoomView.as_view(), name='assign_tenant_to_room'),
    path('<int:room_id>/vacate/', AdminVacateRoomView.as_view(), name='vacate_room'),

    # 3. Room Reservations & Visit Requests
    path('reservations/', RoomReservationListCreateView.as_view(), name='room_reservations'),
    path('reservations/<int:pk>/action/', RoomReservationActionView.as_view(), name='room_reservation_action'),

    # 4. Tenant Move-Out & Final Settlement Endpoints
    path('move-out/status/', MoveOutStatusView.as_view(), name='move_out_status'),
    path('move-out/request/', RequestMoveOutView.as_view(), name='request_move_out'),
    path('move-out/pending/', PendingMoveOutListView.as_view(), name='pending_move_outs'),
    path('move-out/<int:pk>/process/', ProcessMoveOutRequestView.as_view(), name='process_move_out'),

    # 5. Homepage Hero Slideshow Banners
    path('banners/', HeroBannerListCreateView.as_view(), name='hero_banners'),
    path('banners/<int:pk>/', HeroBannerDetailView.as_view(), name='hero_banner_detail'),

    # 6. House Rules & Regulations
    path('rules/', HouseRuleListCreateView.as_view(), name='house_rules'),
    path('rules/<int:pk>/', HouseRuleDetailView.as_view(), name='house_rule_detail'),
]