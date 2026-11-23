import { api, buildQuery } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import { esc, statusBadge, toast, setBusy, debounce, renderPagination, openModal } from '../ui.js';

const pageState = { page: 1, limit: 20 };
const table = document.querySelector('[data-student-table]');
const dialog = document.querySelector('#add-student-dialog');
const form = document.querySelector('#add-student-form');
const saveButton = document.querySelector('#save-student-button');
const searchInput = document.querySelector('#student-search');
const classFilter = document.querySelector('#student-class');
const statusFilter = document.querySelector('#student-status');

async function loadClasses() {
  try {
    const result = await api('GET', '/api/admin/classes');
    const classes = result.data || [];
    const classSelect = document.querySelector('#classId');
    classSelect.innerHTML = '<option value="">No class</option>';

    for (const schoolClass of classes) {
      const filterOption = document.createElement('option');
      filterOption.value = schoolClass.id;
      filterOption.textContent = schoolClass.name;
      classFilter.append(filterOption);

      const formOption = document.createElement('option');
      formOption.value = schoolClass.id;
      formOption.textContent = schoolClass.name;
      classSelect.append(formOption);
    }
  } catch (error) {
    toast(error.message || 'Unable to load classes', 'error');
  }
}

async function loadStudents(page = 1) {
  pageState.page = page;
  table.innerHTML = '<tr><td colspan="4" class="loading-state">Loading students...</td></tr>';

  try {
    const query = buildQuery({
      search: searchInput.value,
      classId: classFilter.value,
      status: statusFilter.value,
      page,
      limit: pageState.limit,
    });
    const result = await api('GET', `/api/admin/students${query}`);

    if (!result.data.length) {
      table.innerHTML = '<tr><td colspan="4" class="empty-state">No students found</td></tr>';
    } else {
      table.innerHTML = result.data.map((student) => `
        <tr data-student-id="${esc(student.id)}" class="clickable-row">
          <td>${esc(student.admissionNumber)}</td>
          <td><strong>${esc(student.fullName || `${student.firstName || ''} ${student.lastName || ''}`)}</strong></td>
          <td>${esc(student.className || 'Not assigned')}</td>
          <td>${statusBadge(student.status || 'active')}</td>
        </tr>`).join('');

      table.querySelectorAll('[data-student-id]').forEach((row) => {
        row.addEventListener('click', () => {
          window.location.href = `/admin/student.html?id=${encodeURIComponent(row.dataset.studentId)}`;
        });
      });
    }

    renderPagination(document.querySelector('[data-student-pagination]'), {
      page: result.page,
      limit: result.limit,
      total: result.total,
    }, loadStudents);
  } catch (error) {
    table.innerHTML = `<tr><td colspan="4" class="error-state">${esc(error.message)} <button type="button" class="secondary-button" data-retry>Try again</button></td></tr>`;
    table.querySelector('[data-retry]').addEventListener('click', () => loadStudents(page));
  }
}

async function submitStudent(event) {
  event.preventDefault();
  setBusy(saveButton, true);

  const formData = new FormData(form);
  const guardianName = String(formData.get('guardianName') || '').trim();
  const guardianRelationship = String(formData.get('guardianRelationship') || '').trim();
  const guardianPhone = String(formData.get('guardianPhone') || '').trim();
  const guardians = guardianName && guardianPhone
    ? [{
        fullName: guardianName,
        relationship: guardianRelationship || 'Guardian',
        phone: guardianPhone,
        isPrimary: true,
      }]
    : [];

  const body = {
    admissionNumber: String(formData.get('admissionNumber') || '').trim(),
    firstName: String(formData.get('firstName') || '').trim(),
    lastName: String(formData.get('lastName') || '').trim(),
    gender: String(formData.get('gender') || '') || undefined,
    dateOfBirth: String(formData.get('dateOfBirth') || '') || undefined,
    classId: String(formData.get('classId') || '') || undefined,
    guardians,
  };

  try {
    const result = await api('POST', '/api/admin/students', body);
    dialog.close();
    form.reset();

    const credentials = document.createElement('div');
    credentials.innerHTML = `
      <p>Student account created.</p>
      <dl>
        <dt>Admission number</dt><dd data-credential-admission></dd>
        <dt>Temporary password</dt><dd data-credential-password></dd>
      </dl>
      <button type="button" class="primary-button" data-copy>Copy password</button>
      <p><strong>This password is shown only once.</strong> Give it to the student or parent.</p>`;
    credentials.querySelector('[data-credential-admission]').textContent = result.student.admissionNumber;
    credentials.querySelector('[data-credential-password]').textContent = result.temporaryPassword;
    credentials.querySelector('[data-copy]').addEventListener('click', async () => {
      await navigator.clipboard?.writeText(result.temporaryPassword);
      toast('Password copied.', 'success');
    });

    openModal({ title: 'Student credentials', content: credentials, onClose: () => {
      credentials.querySelector('[data-credential-password]').textContent = '';
    } });

    await loadStudents(1);
  } catch (error) {
    toast(error.message || 'Unable to create student', 'error');
  } finally {
    setBusy(saveButton, false);
  }
}

form.addEventListener('submit', submitStudent);
document.querySelector('#add-student-button').addEventListener('click', () => dialog.showModal());
document.querySelector('[data-close-dialog]').addEventListener('click', () => dialog.close());
searchInput.addEventListener('input', debounce(() => loadStudents(1), 300));
classFilter.addEventListener('change', () => loadStudents(1));
statusFilter.addEventListener('change', () => loadStudents(1));

async function start() {
  const user = await requireRole('admin');
  if (!user) return;
  await renderNav({ role: 'admin', username: user.username });
  await loadClasses();
  await loadStudents(1);
}

start();
