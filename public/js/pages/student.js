import { api } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import {
  esc,
  formatKES,
  formatDateTime,
  statusBadge,
  toast,
  setBusy,
} from '../ui.js';

const refreshButton = document.querySelector('#refresh-button');
const balanceCard = document.querySelector('[data-balance-card]');
const billsTable = document.querySelector('[data-bills-table]');
const paymentsTable = document.querySelector('[data-payments-table]');
const lastUpdated = document.querySelector('[data-last-updated]');

function renderBalance(totals) {
  const balance = totals.balance;
  const billed = totals.totalBilled;
  const credit = totals.credit;

  let title;
  let detail = '';

  if (billed === '0.00' && balance === '0.00' && credit === '0.00') {
    title = 'No fees have been billed to you yet.';
  } else if (balance !== '0.00') {
    title = `You owe ${formatKES(balance)}`;
    detail = 'Balance due';
  } else if (credit !== '0.00') {
    title = 'Fully paid. No balance.';
    detail = `Overpaid. Credit of ${formatKES(credit)}`;
  } else {
    title = 'Fully paid. No balance.';
  }

  balanceCard.innerHTML = `
    <p class="balance-label">${esc(detail || 'Account balance')}</p>
    <h2 class="balance-amount">${esc(title)}</h2>
    <div class="balance-totals">
      <span><strong>${esc(formatKES(billed))}</strong><small>Total billed</small></span>
      <span><strong>${esc(formatKES(totals.totalPaid))}</strong><small>Total paid</small></span>
      <span><strong>${esc(formatKES(credit))}</strong><small>Credit</small></span>
    </div>`;
}

function renderBills(bills) {
  if (!bills.length) {
    billsTable.innerHTML = '<tr><td colspan="5" class="empty-state">No bills yet</td></tr>';
    return;
  }

  billsTable.innerHTML = bills.map((bill) => `
    <tr>
      <td><strong>${esc(bill.termName)}</strong><br><small>${esc(bill.yearName)}</small></td>
      <td>${esc(formatKES(bill.amount))}</td>
      <td>${esc(formatKES(bill.paidAmount))}</td>
      <td>${esc(formatKES(bill.remaining))}</td>
      <td>${statusBadge(bill.status)}</td>
    </tr>`).join('');
}

function renderPayments(payments) {
  if (!payments.length) {
    paymentsTable.innerHTML = '<tr><td colspan="5" class="empty-state">No payments yet</td></tr>';
    return;
  }

  paymentsTable.innerHTML = payments.map((payment) => {
    const reversed = payment.status === 'reversed';
    return `
      <tr>
        <td>${esc(formatDateTime(payment.paidAt))}</td>
        <td>${esc(payment.method)}</td>
        <td>${esc(payment.reference || '-')}</td>
        <td class="${reversed ? 'strike' : ''}">${esc(formatKES(payment.amount))}</td>
        <td>${statusBadge(reversed ? 'Reversed' : 'Valid')}</td>
      </tr>`;
  }).join('');
}

async function loadStatement() {
  setBusy(refreshButton, true);
  try {
    const config = await api('GET', '/api/config');
    const statement = await api('GET', '/api/student/me/statement');

    const student = statement.student;
    if (student) {
      document.querySelector('[data-student-name]').textContent = student.name;
      document.querySelector('[data-student-meta]').textContent =
        `${student.admissionNumber}${student.className ? ` · ${student.className}` : ''}`;
    }

    renderBalance(statement.totals);
    renderBills(statement.bills);
    renderPayments(statement.payments);

    const instructions = document.querySelector('[data-payment-instructions]');
    if (config.paymentInstructions) {
      instructions.hidden = false;
      document.querySelector('[data-payment-instructions-text]').textContent = config.paymentInstructions;
    } else {
      instructions.hidden = true;
    }

    lastUpdated.textContent = `Last updated: ${formatDateTime(new Date().toISOString())}`;
  } catch (error) {
    const message = error.message || 'Unable to load account';
    balanceCard.innerHTML = `<div class="error-state"><p>${esc(message)}</p><button type="button" class="secondary-button" data-retry>Try again</button></div>`;
    billsTable.innerHTML = `<tr><td colspan="5" class="error-state">${esc(message)}</td></tr>`;
    paymentsTable.innerHTML = `<tr><td colspan="5" class="error-state">${esc(message)}</td></tr>`;
    balanceCard.querySelector('[data-retry]').addEventListener('click', loadStatement);
    toast(message, 'error');
  } finally {
    setBusy(refreshButton, false);
  }
}

async function start() {
  const user = await requireRole('student');
  if (!user) return;

  let config = {};
  try {
    config = await api('GET', '/api/config');
  } catch (_) {}

  await renderNav({ role: 'student', schoolName: config.schoolName });
  await loadStatement();

  refreshButton.addEventListener('click', loadStatement);
  setInterval(() => {
    if (!document.hidden) loadStatement();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) loadStatement();
  });
}

start();

// Student portal page implementation is pending in the next frontend phase.
