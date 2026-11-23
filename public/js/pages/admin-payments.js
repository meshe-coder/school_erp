import { api, buildQuery } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import {
  esc,
  formatKES,
  formatDateTime,
  statusBadge,
  toast,
  setBusy,
  debounce,
  renderPagination,
  confirmDialog,
  showFormError,
} from '../ui.js';

const studentSearch = document.querySelector('#student-search');
const studentResults = document.querySelector('#student-results');
const selectedStudent = document.querySelector('#selected-student');
const paymentForm = document.querySelector('#payment-form');
const recordButton = document.querySelector('#record-payment-button');
const studentIdInput = document.querySelector('#studentId');
const methodInput = document.querySelector('#method');
const referenceInput = document.querySelector('#reference');
const referenceHint = document.querySelector('#reference-hint');
const paidAtInput = document.querySelector('#paidAt');

let selectedStudentId = null;
let historyPage = 1;

function localDateTimeNow() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

paidAtInput.value = localDateTimeNow();

function updateReferenceRules() {
  const method = methodInput.value;
  const needsReference = method === 'mpesa' || method === 'bank';
  referenceInput.required = needsReference;
  referenceHint.textContent = method === 'mpesa'
    ? '10-character code, e.g. QGH7XYZ123'
    : method === 'bank'
      ? 'Bank slip or transaction reference'
      : '';
}
methodInput.addEventListener('change', updateReferenceRules);
updateReferenceRules();

async function selectStudent(student) {
  selectedStudentId = student.id;
  studentIdInput.value = student.id;
  studentResults.innerHTML = '';
  studentSearch.value = '';

  try {
    const statement = await api('GET', `/api/admin/students/${student.id}/statement`);
    selectedStudent.innerHTML = `
      <strong>${esc(statement.student.name)}</strong>
      <span>${esc(statement.student.admissionNumber)}${statement.student.className ? ` · ${esc(statement.student.className)}` : ''}</span>
      <span>Current balance: <strong>${esc(statement.totals.balance === '0.00' ? 'KES 0.00' : `KES ${statement.totals.balance}`)}</strong></span>`;
  } catch (error) {
    selectedStudent.textContent = error.message;
  }
}

const searchStudents = debounce(async () => {
  const search = studentSearch.value.trim();
  if (!search) {
    studentResults.innerHTML = '';
    return;
  }

  try {
    const result = await api('GET', `/api/admin/students${buildQuery({ search, limit: 8 })}`);
    const rows = result.data || [];
    if (!rows.length) {
      studentResults.innerHTML = '<div class="search-empty">No students found</div>';
      return;
    }

    studentResults.innerHTML = '';
    for (const student of rows) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      button.textContent = `${student.admissionNumber} — ${student.firstName} ${student.lastName}`;
      button.addEventListener('click', () => selectStudent({
        id: student.id,
        name: `${student.firstName} ${student.lastName}`,
      }));
      studentResults.append(button);
    }
  } catch (error) {
    studentResults.textContent = error.message;
  }
}, 300);
studentSearch.addEventListener('input', searchStudents);

async function preselectStudent(studentId) {
  try {
    const statement = await api('GET', `/api/admin/students/${studentId}/statement`);
    selectStudent({ id: studentId });
  } catch (error) {
    toast(error.message, 'error');
  }
}

paymentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedStudentId) {
    showFormError(paymentForm, { message: 'Select a student first.' });
    return;
  }

  setBusy(recordButton, true);
  const formData = new FormData(paymentForm);
  const paidAtValue = String(formData.get('paidAt') || '');

  try {
    const body = {
      studentId: selectedStudentId,
      amount: String(formData.get('amount')),
      method: String(formData.get('method')),
      reference: String(formData.get('reference') || '').trim() || undefined,
      paidAt: paidAtValue ? new Date(paidAtValue).toISOString() : undefined,
      note: String(formData.get('note') || '').trim() || undefined,
    };

    const result = await api('POST', '/api/admin/payments', body);
    toast(`Payment of ${formatKES(result.payment.amount)} recorded. New balance: ${formatKES(result.totals.balance)}.`, 'success');

    const keepMethod = methodInput.value;
    paymentForm.reset();
    methodInput.value = keepMethod;
    updateReferenceRules();
    paidAtInput.value = localDateTimeNow();

    await selectStudent({ id: selectedStudentId });
    await loadHistory(historyPage);
  } catch (error) {
    showFormError(paymentForm, error);
  } finally {
    setBusy(recordButton, false);
  }
});

async function loadHistory(page = 1) {
  historyPage = page;
  const tbody = document.querySelector('[data-payment-history]');
  tbody.innerHTML = '<tr><td colspan="7" class="loading-state">Loading payments...</td></tr>';

  try {
    const query = buildQuery({
      search: document.querySelector('#history-search').value,
      method: document.querySelector('#history-method').value,
      status: document.querySelector('#history-status').value,
      from: document.querySelector('#history-from').value,
      to: document.querySelector('#history-to').value,
      page,
      limit: 20,
    });
    const result = await api('GET', `/api/admin/payments${query}`);

    if (!result.data.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No payments yet</td></tr>';
    } else {
      tbody.innerHTML = result.data.map((payment) => {
        const reversed = payment.status === 'reversed';
        return `<tr>
          <td>${esc(payment.studentName)}<br><small>${esc(payment.admissionNumber)}</small></td>
          <td class="${reversed ? 'strike' : ''}">${esc(formatKES(payment.amount))}</td>
          <td>${esc(payment.method)}</td>
          <td>${esc(payment.reference || '-')}</td>
          <td>${statusBadge(reversed ? 'Reversed' : 'Valid')}</td>
          <td>${esc(formatDateTime(payment.paidAt))}</td>
          <td>${reversed ? '-' : `<button type="button" class="danger-button" data-reverse="${esc(payment.id)}">Reverse</button>`}</td>
        </tr>`;
      }).join('');

      tbody.querySelectorAll('[data-reverse]').forEach((button) => {
        button.addEventListener('click', () => reversePayment(button.dataset.reverse));
      });
    }

    renderPagination(document.querySelector('[data-payment-pagination]'), {
      page: result.page,
      limit: result.limit,
      total: result.total,
    }, loadHistory);
  } catch (error) {
    tbody.innerHTML = `<tr><td colspan="7" class="error-state">${esc(error.message)} <button type="button" class="secondary-button" data-retry>Try again</button></td></tr>`;
    tbody.querySelector('[data-retry]').addEventListener('click', () => loadHistory(page));
  }
}

async function reversePayment(paymentId) {
  const reason = window.prompt('Reason for reversing this payment (3–255 characters):');
  if (reason === null) return;

  if (reason.trim().length < 3) {
    toast('A reason of at least 3 characters is required.', 'error');
    return;
  }

  if (!confirmDialog('Reverse this payment? This cannot be undone.')) return;

  try {
    await api('POST', `/api/admin/payments/${paymentId}/reverse`, { reason: reason.trim() });
    toast('Payment reversed.', 'success');
    await loadHistory(historyPage);
  } catch (error) {
    toast(error.message, 'error');
  }
}

for (const id of ['history-search', 'history-method', 'history-status', 'history-from', 'history-to']) {
  document.querySelector(`#${id}`).addEventListener(id === 'history-search' ? 'input' : 'change', debounce(() => loadHistory(1), 300));
}

async function start() {
  const user = await requireRole('admin');
  if (!user) return;

  await renderNav({ role: 'admin', username: user.username });
  const studentId = new URLSearchParams(window.location.search).get('studentId');
  if (studentId) await preselectStudent(studentId);
  await loadHistory(1);
}

start();
