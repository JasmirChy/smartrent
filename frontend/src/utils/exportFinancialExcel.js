import * as XLSX from 'xlsx';
import { formatDualDate, formatDualMonthLabel } from './nepaliDate';

export function computeFinancialSummary({ analytics = {}, bills = [], expenses = [] }) {
  const kpis = analytics?.kpis || {};
  const settledBills = bills.filter((b) => ['APPROVED', 'PAID_CASH'].includes(b.status));

  // Current date and 10 days ahead window
  const now = new Date();
  const futureWindowDays = 10;
  const futureDate = new Date();
  futureDate.setDate(now.getDate() + futureWindowDays);

  // Filter open bills: include if overdue OR due within the next 10 days
  const openBills = bills.filter((b) => {
    if (['APPROVED', 'PAID_CASH'].includes(b.status)) return false;

    const dueDateStr = b.due_date || b.cycle_start_date || b.created_at;
    if (!dueDateStr) return true; // Include if no date exists

    const dueDate = new Date(dueDateStr);
    
    // Include if due date has already passed OR is within the next 10 days
    return dueDate <= futureDate;
  });

  const calculatedRevenue = settledBills.reduce((sum, b) => sum + Number(b.total_payable || 0), 0);
  const calculatedPending = openBills.reduce((sum, b) => sum + Number(b.total_payable || 0), 0);
  const calculatedExpenses = expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const calculatedElec = settledBills.reduce((sum, b) => sum + Number(b.electricity_amount || 0), 0);
  const calculatedWater = settledBills.reduce((sum, b) => sum + Number(b.water_bill || 0), 0);
  const calculatedFines = settledBills.reduce((sum, b) => sum + Number(b.damage_fine_amount || 0), 0);

  const totalRevenue = Number(kpis.total_revenue || 0) || calculatedRevenue;
  const totalExpenses = Number(kpis.total_expenses || 0) || calculatedExpenses;
  const netProfit = totalRevenue - totalExpenses;

  return {
    settledBills,
    openBills,
    totalRevenue,
    totalPending: calculatedPending,
    totalExpenses,
    netProfit,
    electricityCollected: Number(kpis.electricity_collected || 0) || calculatedElec,
    waterCollected: Number(kpis.water_collected || 0) || calculatedWater,
    finesCollected: Number(kpis.fines_collected || 0) || calculatedFines,
  };
}

export function exportSmartRentFinancialExcel({
  analytics = {},
  bills = [],
  expenses = [],
  tenants = [],
}) {
  const wb = XLSX.utils.book_new();
  const kpis = analytics?.kpis || {};
  const todayStr = new Date().toISOString().split('T')[0];
  const stats = computeFinancialSummary({ analytics, bills, expenses });

  // SHEET 1: EXECUTIVE SUMMARY
  const summaryRows = [
    ['SMARTRENT PROPERTY MANAGEMENT — INCOME, EXPENSES & RECEIPTS REPORT'],
    ['Generated On (AD / BS)', formatDualDate(todayStr)],
    [],
    ['KEY FINANCIAL METRIC', 'AMOUNT (NPR)'],
    ['Total Collected Income (Approved & Cash)', stats.totalRevenue],
    ['  • Electricity Collected', stats.electricityCollected],
    ['  • Water Supply Collected', stats.waterCollected],
    ['  • Damage / Rule Fines Collected', stats.finesCollected],
    ['Pending / Unpaid Tenant Dues (Receivable)', stats.totalPending],
    ['Total Whole-House Expenses', stats.totalExpenses],
    ['Net Property Profit (Collected - Expenses)', stats.netProfit],
    [],
    ['UNIT & INVOICE COUNTS', 'COUNT'],
    ['Occupied / Total Rooms', `${kpis.occupied_rooms || 0} / ${kpis.total_rooms || 0}`],
    ['Settled Receipts Count', stats.settledBills.length],
    ['Open / Unpaid Invoices Count', stats.openBills.length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 44 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // SHEET 2: TENANT PAYMENTS & RECEIPTS
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
    'Prev Meter': Number(b.previous_meter_reading || 0),
    'Curr Meter': b.current_meter_reading != null ? Number(b.current_meter_reading) : '',
    'Units Used': Number(b.units_consumed || 0),
    'Electricity (Rs.)': Number(b.electricity_amount || 0),
    'Fine (Rs.)': Number(b.damage_fine_amount || 0),
    'Fine Reason': b.damage_fine_reason || '',
    'Total Amount (Rs.)': Number(b.total_payable || 0),
    'Method': b.payment_method || 'PENDING',
    'Status': b.status_display || b.status,
    'Settled Date': b.paid_at ? formatDualDate(b.paid_at.split('T')[0]) : 'Not Settled',
  }));

  const wsPayments = XLSX.utils.json_to_sheet(
    paymentRows.length > 0 ? paymentRows : [{ Info: 'No bills or receipts recorded yet.' }]
  );
  wsPayments['!cols'] = Array(20).fill({ wch: 18 });
  XLSX.utils.book_append_sheet(wb, wsPayments, 'Payments & Receipts');

  // SHEET 3: HOUSE EXPENSES
  const expenseRows = expenses.map((exp, idx) => ({
    'S.N.': idx + 1,
    'Expense Date (AD / BS)': exp.expense_date ? formatDualDate(exp.expense_date) : 'N/A',
    'Category': exp.category_display || exp.category,
    'Expense Title': exp.title || '',
    'Amount (Rs.)': Number(exp.amount || 0),
    'Notes': exp.notes || '',
  }));
  const wsExpenses = XLSX.utils.json_to_sheet(
    expenseRows.length > 0 ? expenseRows : [{ Info: 'No house expenses recorded yet.' }]
  );
  wsExpenses['!cols'] = [{ wch: 6 }, { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 16 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wsExpenses, 'House Expenses');

  // SHEET 4: TENANT SUMMARY
  const tenantRows = tenants.map((u, idx) => ({
    'S.N.': idx + 1,
    'Tenant Name': u.full_name || '',
    'Email': u.email || '',
    'Phone': u.phone_number || '',
    'Room': u.room_number ? `Room ${u.room_number}` : 'Unassigned',
    'Total Paid (Rs.)': Number(u.total_paid_amount || 0),
    'Pending Dues (Rs.)': Number(u.total_pending_amount || 0),
  }));
  const wsTenants = XLSX.utils.json_to_sheet(
    tenantRows.length > 0 ? tenantRows : [{ Info: 'No registered tenants.' }]
  );
  wsTenants['!cols'] = [{ wch: 6 }, { wch: 22 }, { wch: 25 }, { wch: 15 }, { wch: 14 }, { wch: 18 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsTenants, 'Tenant Summary');

  XLSX.writeFile(wb, `SmartRent-Income-Expenses-Receipts-${todayStr}.xlsx`);
}