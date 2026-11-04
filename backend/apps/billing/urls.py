from django.urls import path
from .views import (
    BillListView,
    TenantSubmitOnlineBillView,
    AdminAuditBillView,
    AdminCashOverrideView,
    AdminApplyFineView,
    HouseExpenseListCreateView,
    HouseExpenseDetailView,
    AdminAnalyticsDashboardView,
    TriggerDueRemindersView,
)

urlpatterns = [
    path('', BillListView.as_view(), name='bills_list'),
    path('<int:bill_id>/submit-online/', TenantSubmitOnlineBillView.as_view(), name='bill_submit_online'),
    path('<int:bill_id>/audit/', AdminAuditBillView.as_view(), name='bill_admin_audit'),
    path('<int:bill_id>/apply-fine/', AdminApplyFineView.as_view(), name='bill_apply_fine'),
    path('cash-override/', AdminCashOverrideView.as_view(), name='bill_cash_override'),
    path('expenses/', HouseExpenseListCreateView.as_view(), name='expenses_list_create'),
    path('expenses/<int:pk>/', HouseExpenseDetailView.as_view(), name='expense_detail'),
    path('analytics/', AdminAnalyticsDashboardView.as_view(), name='admin_analytics'),
    path('send-due-reminders/', TriggerDueRemindersView.as_view(), name='send_due_reminders'),
]