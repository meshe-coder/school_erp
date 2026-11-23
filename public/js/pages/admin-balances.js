import { api, buildQuery } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import { esc, formatKES, renderPagination, debounce } from '../ui.js';

const searchInput = document.querySelector('#balance-search');
const classSelect = document.querySelector('#balance-class');
const owingOnly = document.querySelector('#owing-only');
const rowsContainer = document.querySelector('[data-balance-rows]');
const summaryContainer = document.querySelector('[data-balance-summary]');
const paginationContainer = document.querySelector('[data-balance-pagination]');
const state = { page: 1, limit: 20 };

async function loadClasses() {
  const result = await api('GET', '/api/admin/classes');
  for (const schoolClass of result.data || []) {
    const option = document.createElement('option');
    option.value = schoolClass.id;
    option.textContent = schoolClass.name;
    classSelect.append(option);
  }
}

function renderSummary(summary = {}) {
  const items = [
    ['Students', summary.studentCount ?? 0],
    ['Students owing', summary.studentsOwing ?? 0],
    ['Total billed', formatKES(summary.totalBilled)],
    ['Total paid', formatKES(summary.totalPaid)],
    ['Outstanding', formatKES(summary.totalOutstanding)],
  ];
  summaryContainer.innerHTML = items.map(([label, value]) => `
    <div class="summary-item"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`).join('');
}

async function loadBalances(page = 1) {
  state.page = page;
  rowsContainer.innerHTML = '<tr><td colspan="7" class="loading-state">Loading balances...</td></tr>';
  summaryContainer.innerHTML = '<div class="loading-state">Loading summary...</div>';

  try {
    const query = buildQuery({
      search: searchInput.value.trim(),
      classId: classSelect.value,
      owing: owingOnly.checked ? 'true' : undefined,
      page,
      limit: state.limit,
    });
    const result = await api('GET', `/api/admin/balances${query}`);
    renderSummary(result.summary);

    if (!result.data?.length) {
      rowsContainer.innerHTML = '<tr><td colspan="7" class="empty-state">No students with bills match these filters.</td></tr>';
    } else {
      rowsContainer.innerHTML = result.data.map((student) => `
        <tr class="clickable-row" data-student-id="${esc(student.studentId)}">
          <td>${esc(student.admissionNumber)}</td>
          <td><strong>${esc(student.fullName)}</strong></td>
          <td>${esc(student.className || '—')}</td>
          <td>${esc(formatKES(student.totalBilled))}</td>
          <td>${esc(formatKES(student.totalPaid))}</td>
          <td class="${student.balance !== '0.00' ? 'balance-due' : ''}">${esc(formatKES(student.balance))}</td>
          <td>${esc(formatKES(student.credit))}</td>
        </tr>`).join('');

      rowsContainer.querySelectorAll('[data-student-id]').forEach((row) => {
        row.addEventListener('click', () => {
          window.location.href = `/admin/student.html?id=${encodeURIComponent(row.dataset.studentId)}`;
        });
      });
    }

    renderPagination(paginationContainer, {
      page: result.page,
      limit: result.limit,
      total: result.total,
    }, loadBalances);
  } catch (error) {
    rowsContainer.innerHTML = `<tr><td colspan="7" class="error-state">${esc(error.message)} <button type="button" class="secondary-button" data-retry>Try again</button></td></tr>`;
    summaryContainer.replaceChildren();
    rowsContainer.querySelector('[data-retry]').addEventListener('click', () => loadBalances(page));
  }
}

searchInput.addEventListener('input', debounce(() => loadBalances(1), 300));
classSelect.addEventListener('change', () => loadBalances(1));
owingOnly.addEventListener('change', () => loadBalances(1));

async function start() {
  const user = await requireRole('admin');
  if (!user) return;
  await renderNav({ role: 'admin', username: user.username });
  try {
    await loadClasses();
  } catch (_) {
    // Class filtering is optional; balances still load if class options fail.
  }
  await loadBalances(1);
}

start();
