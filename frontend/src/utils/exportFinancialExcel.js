import * as XLSX from 'xlsx';
import { formatDualDate, formatDualMonthLabel } from './nepaliDate';

export function exportSmartRentFinancialExcel({
  analytics = {},
  bills = [],
  expenses = [],
  tenants = [],
}) {
  const wb = XLSX.utils.book_new();
  const kpis = analytics?.kpis || {};
  const todayStr = new Date().toISOString().split('T')[0];

  // =========================================================================
  // SHEET 1: EXECUTIVE SUMMARY
  // =========================================================================
  const summaryRows = [
    ['SMARTRENT PROPERTY MANAGEMENT — INCOME, EXPENSES & RECEIPTS REPORT'],
    ['Generated On (AD / BS)', formatDualDate(todayStr)],
    [],
    ['KEY FINANCIAL METRIC', 'AMOUNT / VALUE'],
    ['Total Collected Revenue (NPR)', Number(kpis.total_revenue || 0)],
    ['  • Electricity Collected (NPR)', Number(kpis.electricity_collected || 0)],
    ['  • Water Supply Collected (NPR)', Number(kpis.water_collected || 0)],
    ['  • Damage / Rule Fines Collected (NPR)', Number(kpis.fines_collected || 0)],
    ['Total Whole-House Expenses (NPR)', Number(kpis.total_expenses || 0)],
    ['Net Property Profit (NPR)', Number(kpis.net_profit || 0)],
    [],
    ['OCCUPANCY & INVOICE STATUS', 'COUNT'],
    ['Occupied Rooms / Total Rooms', `${kpis.occupied_rooms || 0} / ${kpis.total_rooms || 0}`],
    ['Pending Audit Invoices', Number(kpis.pending_verifications_count || 0)],
    ['Unpaid Open Invoices', Number(kpis.unpaid_bills_count || 0)],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 42 }, { wch: 28 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // =========================================================================
  // SHEET 2: TENANT PAYMENTS & RECEIPTS (HOW MUCH PAYMENT FROM WHOM)
  // =========================================================================
  const paymentRows = bills.map((b, idx) => ({
    'S.N.': idx + 1,
    'Receipt / Ref ID': b.transaction_reference || `BILL-${b.id}`,
    'Tenant Name': b.tenant_name || 'N/A',
    'Tenant Email': b.tenant_email || '',
    'Tenant Phone': b.tenant_phone || '',
    'Room No.': b.room_number || '',
    'Billing Cycle (AD / BS)': formatDualMonthLabel(b.billing_month_label),
    'Due Date (AD / BS)': formatDualDate(b.due_date, 'N/A'),
    'Base Rent (Rs.)': Number(b.base_rent || 0),
    'Water Bill (Rs.)': Number(b.water_bill || 0),
    'Prev Meter (kWh)': Number(b.previous_meter_reading || 0),
    'Curr Meter (kWh)': b.current_meter_reading != null ? Number(b.current_meter_reading) : '',
    'Units Used': Number(b.units_consumed || 0),
    'Electricity (Rs.)': Number(b.electricity_amount || 0),
    'Fine Amount (Rs.)': Number(b.damage_fine_amount || 0),
    'Fine Reason': b.damage_fine_reason || '',
    'Total Payable / Paid (Rs.)': Number(b.total_payable || 0),
    'Payment Method': b.payment_method || 'PENDING',
    'Status': b.status_display || b.status,
    'Paid / Verified Date': b.paid_at ? formatDualDate(b.paid_at.split('T')[0]) : 'Not Settled',
    'Meter Photo URL': b.meter_photo_url || '',
    'Receipt Screenshot URL': b.payment_screenshot_url || '',
  }));

  const wsPayments = XLSX.utils.json_to_sheet(
    paymentRows.length > 0
      ? paymentRows
      : [{ Info: 'No tenant invoices or payment receipts recorded yet.' }]
  );
  wsPayments['!cols'] = [
    { wch: 6 },  // S.N.
    { wch: 18 }, // Ref ID
    { wch: 22 }, // Tenant Name
    { wch: 24 }, // Email
    { wch: 14 }, // Phone
    { wch: 10 }, // Room
    { wch: 24 }, // Cycle
    { wch: 22 }, // Due Date
    { wch: 15 }, // Rent
    { wch: 14 }, // Water
    { wch: 15 }, // Prev
    { wch: 15 }, // Curr
    { wch: 12 }, // Units
    { wch: 16 }, // Elec
    { wch: 15 }, // Fine
    { wch: 24 }, // Fine Reason
    { wch: 22 }, // Total
    { wch: 15 }, // Method
    { wch: 20 }, // Status
    { wch: 22 }, // Paid Date
    { wch: 35 }, // Meter URL
    { wch: 35 }, // Receipt URL
  ];
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments & Receipts');

  // =========================================================================
  // SHEET 3: WHOLE-HOUSE EXPENSES LEDGER (WHAT EXPENSES)
  // =========================================================================
  const expenseRows = expenses.map((exp, idx) => ({
    'S.N.': idx + 1,
    'Expense Date (AD / BS)': formatDualDate(exp.expense_date),
    'Category': exp.category_display || exp.category,
    'Expense Title': exp.title || '',
    'Amount (Rs.)': Number(exp.amount || 0),
    'Notes / Remarks': exp.notes || '',
    'Receipt Image URL': exp.receipt_image_url || '',
  }));

  const wsExpenses = XLSX.utils.json_to_sheet(
    expenseRows.length > 0
      ? expenseRows
      : [{ Info: 'No house expenses logged yet.' }]
  );
  wsExpenses['!cols'] = [
    { wch: 6 },
    { wch: 24 },
    { wch: 24 },
    { wch: 28 },
    { wch: 16 },
    { wch: 32 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'House Expenses');

  // =========================================================================
  // SHEET 4: TENANT LEDGER SUMMARY
  // =========================================================================
  const tenantRows = tenants.map((u, idx) => ({
    'S.N.': idx + 1,
    'Tenant Name': u.full_name || '',
    'Email': u.email || '',
    'Phone': u.phone_number || '',
    'Assigned Room': u.room_number ? `Room ${u.room_number}` : 'Unassigned',
    'KYC Status': u.kyc_status || 'PENDING',
    'Total Paid History (Rs.)': Number(u.total_paid_amount || 0),
    'Pending Dues (Rs.)': Number(u.total_pending_amount || 0),
    'Open Bills Count': Number(u.pending_bills_count || 0),
  }));

  const wsTenants = XLSX.utils.json_to_sheet(
    tenantRows.length > 0
      ? tenantRows
      : [{ Info: 'No registered tenants yet.' }]
  );
  wsTenants['!cols'] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 25 },
    { wch: 15 },
    { wch: 15 },
    { wch: 14 },
    { wch: 20 },
    { wch: 18 },
    { wch: 16 },
  ];
  XLSX.utils.book_append_sheet(wb, wsTenants, 'Tenant Summary');

  XLSX.writeFile(wb, `SmartRent-Income-Expenses-Receipts-${todayStr}.xlsx`);
}