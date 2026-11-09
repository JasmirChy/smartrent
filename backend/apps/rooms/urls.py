from django.urls import path
from .views import (
    PublicLandingDataView,
    RoomListUpdateView,
    AdminRoomDetailUpdateView,
    AdminAssignTenantToRoomView,
    AdminVacateRoomView,
    RoomReservationListCreateView,
    RoomReservationActionView,
    HeroBannerListCreateView,
    HeroBannerDetailView,
    HouseRuleListCreateView,
    HouseRuleDetailView,
)

urlpatterns = [
    path('landing/', PublicLandingDataView.as_view(), name='public_landing_data'),
    path('', RoomListUpdateView.as_view(), name='rooms_list'),
    path('<int:pk>/', AdminRoomDetailUpdateView.as_view(), name='room_detail_update'),
    path('<int:room_id>/assign-tenant/', AdminAssignTenantToRoomView.as_view(), name='room_assign_tenant'),
    path('<int:room_id>/vacate/', AdminVacateRoomView.as_view(), name='room_vacate'),
    path('reservations/', RoomReservationListCreateView.as_view(), name='room_reservations_list_create'),
    path('reservations/<int:pk>/action/', RoomReservationActionView.as_view(), name='room_reservation_action'),
    path('banners/', HeroBannerListCreateView.as_view(), name='hero_banners_list_create'),
    path('banners/<int:pk>/', HeroBannerDetailView.as_view(), name='hero_banner_detail'),
    path('rules/', HouseRuleListCreateView.as_view(), name='house_rules_list_create'),
    path('rules/<int:pk>/', HouseRuleDetailView.as_view(), name='house_rule_detail'),
]