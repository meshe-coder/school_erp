import { api } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import { esc, formatKES, formatDateTime, toast } from '../ui.js';

const cards = document.querySelector('[data-dashboard-cards]');
const banners = document.querySelector('[data-dashboard-banners]');
const recentPayments = document.querySelector('[data-recent-payments]');

function renderCards(data) {
  const currentTerm = data.currentAcademicYear?.termName || 'Not set';
  const items = [
    ['Total billed', formatKES(data.totalBilled)],
    ['Total paid', formatKES(data.totalPaid)],
    ['Outstanding', formatKES(data.totalOutstanding)],
    ['Students owing', data.studentsOwing ?? 0],
    ['Students fully paid', data.studentsCleared ?? 0],
    ['Current term', currentTerm],
  ];

  cards.innerHTML = items.map(([label, value]) => `
    <article class="card metric-card">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </article>`).join('');
}

function renderBanners(data) {
  const items = [];
  if (!data.currentAcademicYear?.termName) {
    items.push('<a class="banner banner-warning" href="/admin/setup.html">Set the current term in Setup</a>');
  }
  if (data.totalBilled === '0.00' || data.studentCount === 0) {
    items.push('<a class="banner banner-info" href="/admin/fees.html">Generate bills in Fees &amp; Billing</a>');
  }
  banners.innerHTML = items.join('');
}

function renderRecentPayments(payments) {
  if (!payments?.length) {
    recentPayments.innerHTML = '<tr><td colspan="4" class="empty-state">No payments yet</td></tr>';
    return;
  }

  recentPayments.innerHTML = payments.map((payment) => `
    <tr>
      <td>${esc(payment.studentName)}</td>
      <td>${esc(formatKES(payment.amount))}</td>
      <td>${esc(payment.method)}</td>
      <td>${esc(formatDateTime(payment.paidAt))}</td>
    </tr>`).join('');
}

async function loadDashboard() {
  cards.innerHTML = '<article class="card"><div class="loading-state">Loading dashboard...</div></article>';
  recentPayments.innerHTML = '<tr><td colspan="4" class="loading-state">Loading payments...</td></tr>';

  try {
    const data = await api('GET', '/api/admin/dashboard');
    renderCards(data);
    renderBanners(data);
    renderRecentPayments(data.recentPayments);
  } catch (error) {
    cards.innerHTML = `<article class="card error-state">Unable to load dashboard.<br><button type="button" class="secondary-button" data-retry>Try again</button></article>`;
    cards.querySelector('[data-retry]').addEventListener('click', loadDashboard);
    toast(error.message || 'Unable to load dashboard', 'error');
  }
}

async function start() {
  const user = await requireRole('admin');
  if (!user) return;

  await renderNav({ role: 'admin', username: user.username });
  await loadDashboard();
}

start();

// Admin dashboard page implementation is pending in the next frontend phase.
