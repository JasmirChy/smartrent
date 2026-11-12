from django.urls import path
from .views import (
    BillListView,
    PaymentQRConfigView,
    TenantSubmitOnlineBillView,
    AdminAuditBillView,
    AdminCashOverrideView,
    BulkGenerateBillsView,
    AdminApplyFineView,
    HouseExpenseListCreateView,
    HouseExpenseDetailView,
    AdminAnalyticsDashboardView,
    TriggerDueRemindersView,
)

urlpatterns = [
    path('', BillListView.as_view(), name='bills_list'),
    path('payment-qr/', PaymentQRConfigView.as_view(), name='payment_qr_config'),
    path('<int:bill_id>/submit-online/', TenantSubmitOnlineBillView.as_view(), name='submit_online_bill'),
    path('<int:bill_id>/audit/', AdminAuditBillView.as_view(), name='admin_audit_bill'),
    path('<int:bill_id>/apply-fine/', AdminApplyFineView.as_view(), name='admin_apply_fine'),
    path('cash-override/', AdminCashOverrideView.as_view(), name='admin_cash_override'),
    path('bulk-generate/', BulkGenerateBillsView.as_view(), name='bulk_generate_bills'),
    path('expenses/', HouseExpenseListCreateView.as_view(), name='house_expenses'),
    path('expenses/<int:pk>/', HouseExpenseDetailView.as_view(), name='house_expense_detail'),
    path('analytics/', AdminAnalyticsDashboardView.as_view(), name='admin_analytics'),
    path('send-due-reminders/', TriggerDueRemindersView.as_view(), name='send_due_reminders'),
]