import { api } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import { esc, toast, setBusy, confirmDialog } from '../ui.js';

const termSelect = document.querySelector('#term-select');
const classFeesBody = document.querySelector('[data-class-fees]');
const feesStatus = document.querySelector('[data-fees-status]');
const missingSummary = document.querySelector('[data-missing-summary]');
const missingStudents = document.querySelector('[data-missing-students]');
const saveButton = document.querySelector('#save-fees-button');
const generateButton = document.querySelector('#generate-bills-button');
const generateResult = document.querySelector('[data-generate-result]');

let terms = [];
let classRows = [];

async function loadTerms() {
  const response = await api('GET', '/api/admin/academic-years');
  const years = response.data || [];
  terms = years.flatMap((year) => (year.terms || []).map((term) => ({
    ...term,
    yearName: year.name,
    isCurrent: term.isCurrent,
    yearIsCurrent: year.isCurrent,
  })));

  termSelect.innerHTML = '';
  if (!terms.length) {
    termSelect.innerHTML = '<option value="">No terms configured</option>';
    classFeesBody.innerHTML = '<tr><td colspan="4" class="empty-state">Add an academic year and term in Setup first.</td></tr>';
    missingSummary.textContent = 'No terms are configured.';
    return;
  }

  const currentTerm = terms.find((term) => term.isCurrent && term.yearIsCurrent) || terms.find((term) => term.isCurrent);
  for (const term of terms) {
    const option = document.createElement('option');
    option.value = term.id;
    option.textContent = `${term.yearName} · ${term.name}${term.isCurrent ? ' (Current)' : ''}`;
    termSelect.append(option);
  }
  if (currentTerm) termSelect.value = currentTerm.id;
  await loadTermData();
}

function renderClassFees(rows) {
  classRows = rows;
  if (!rows.length) {
    classFeesBody.innerHTML = '<tr><td colspan="4" class="empty-state">No classes for this term’s academic year. Add classes in Setup.</td></tr>';
    return;
  }

  classFeesBody.innerHTML = rows.map((row) => `
    <tr>
      <td><strong>${esc(row.className)}</strong></td>
      <td>${esc(row.gradeLevelName)}</td>
      <td>${esc(row.enrolledStudentCount)}</td>
      <td><label class="visually-hidden" for="fee-${esc(row.classId)}">Fee for ${esc(row.className)}</label>
        <input id="fee-${esc(row.classId)}" class="class-fee-input" data-class-id="${esc(row.classId)}" type="number" min="0.01" max="99999999.99" step="0.01" value="${row.amount === null ? '' : esc(row.amount)}" placeholder="Not set"></td>
    </tr>`).join('');
}

async function loadMissingFees(termId) {
  try {
    const result = await api('GET', `/api/admin/terms/${termId}/student-fees?missingFee=true&limit=20`);
    const count = result.summary?.studentsWithoutFee ?? result.total ?? 0;
    missingSummary.textContent = count
      ? `${count} student${count === 1 ? '' : 's'} have no effective fee. First ${result.data.length} shown:`
      : 'All enrolled students have an effective fee.';

    if (!result.data.length) {
      missingStudents.innerHTML = '<li class="empty-state">No students are missing a fee.</li>';
      return;
    }

    missingStudents.innerHTML = result.data.slice(0, 20).map((student) =>
      `<li><strong>${esc(student.admissionNumber)}</strong> — ${esc(student.fullName)} <span>${esc(student.className)}</span></li>`
    ).join('');
  } catch (error) {
    missingSummary.textContent = `Unable to load missing-fee list: ${error.message}`;
    missingStudents.replaceChildren();
  }
}

async function loadTermData() {
  const termId = termSelect.value;
  generateResult.textContent = '';
  if (!termId) return;

  classFeesBody.innerHTML = '<tr><td colspan="4" class="loading-state">Loading class fees...</td></tr>';
  try {
    const result = await api('GET', `/api/admin/terms/${termId}/class-fees`);
    renderClassFees(result.data || []);
    feesStatus.textContent = '';
    await loadMissingFees(termId);
  } catch (error) {
    classFeesBody.innerHTML = `<tr><td colspan="4" class="error-state">${esc(error.message)} <button type="button" class="secondary-button" data-retry>Try again</button></td></tr>`;
    classFeesBody.querySelector('[data-retry]').addEventListener('click', loadTermData);
  }
}

async function saveFees() {
  const termId = termSelect.value;
  if (!termId) {
    toast('Select a term first.', 'error');
    return;
  }

  const fees = [...document.querySelectorAll('.class-fee-input')]
    .filter((input) => input.value.trim() !== '')
    .map((input) => ({ classId: input.dataset.classId, amount: input.value.trim() }));

  if (!fees.length) {
    feesStatus.textContent = 'Enter at least one class fee before saving.';
    return;
  }

  setBusy(saveButton, true);
  try {
    const result = await api('PUT', `/api/admin/terms/${termId}/class-fees`, { fees });
    renderClassFees(result.data || []);
    feesStatus.textContent = 'Class fees saved successfully.';
    toast('Class fees saved.', 'success');
    await loadMissingFees(termId);
  } catch (error) {
    feesStatus.textContent = error.message || 'Unable to save fees.';
    toast(error.message || 'Unable to save fees.', 'error');
  } finally {
    setBusy(saveButton, false);
  }
}

async function generateBills() {
  const termId = termSelect.value;
  if (!termId) {
    toast('Select a term first.', 'error');
    return;
  }

  const refresh = document.querySelector('#refresh-bills').checked;
  const confirmText = refresh
    ? 'Generate bills and update existing bills to the latest fees?'
    : 'Generate bills for students who do not already have a bill?';
  if (!confirmDialog(confirmText)) return;

  setBusy(generateButton, true);
  generateResult.textContent = 'Generating bills...';
  try {
    const result = await api('POST', `/api/admin/terms/${termId}/generate-bills`, { refresh });
    generateResult.textContent = `Created ${result.created} bills, updated ${result.updated}, ${result.unchanged} already billed, ${result.skippedNoFee} skipped because no fee is set.`;
    await loadMissingFees(termId);
  } catch (error) {
    generateResult.textContent = error.message || 'Unable to generate bills.';
  } finally {
    setBusy(generateButton, false);
  }
}

termSelect.addEventListener('change', loadTermData);
saveButton.addEventListener('click', saveFees);
generateButton.addEventListener('click', generateBills);

async function start() {
  const user = await requireRole('admin');
  if (!user) return;
  await renderNav({ role: 'admin', username: user.username });
  try {
    await loadTerms();
  } catch (error) {
    termSelect.innerHTML = '<option value="">Unable to load terms</option>';
    toast(error.message || 'Unable to load academic terms', 'error');
  }
}

start();
