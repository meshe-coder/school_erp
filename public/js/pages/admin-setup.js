import { api } from '../api.js';
import { requireRole } from '../guard.js';
import { renderNav } from '../nav.js';
import { esc, statusBadge, toast, setBusy } from '../ui.js';

async function loadAcademicSetup() {
  const result = await api('GET', '/api/admin/academic-years');
  const years = result.data || [];
  const yearsTable = document.querySelector('[data-years-table]');
  const termYear = document.querySelector('#term-year');
  const classYear = document.querySelector('#class-year');

  termYear.innerHTML = '<option value="">Select year</option>';
  classYear.innerHTML = '<option value="">Select year</option>';

  yearsTable.innerHTML = years.length ? years.map((year) => `
    <tr>
      <td><strong>${esc(year.name)}</strong></td>
      <td>${esc(year.startDate)} – ${esc(year.endDate)}</td>
      <td>${statusBadge(year.isCurrent ? 'Current' : 'Not current')}</td>
      <td><button type="button" class="secondary-button" data-current-year="${esc(year.id)}">Set as current</button></td>
    </tr>`).join('') : '<tr><td colspan="4" class="empty-state">No academic years yet</td></tr>';

  for (const year of years) {
    const termOption = document.createElement('option');
    termOption.value = year.id;
    termOption.textContent = year.name;
    termYear.append(termOption);

    const classOption = document.createElement('option');
    classOption.value = year.id;
    classOption.textContent = year.name;
    classYear.append(classOption);

    if (year.isCurrent) {
      termYear.value = year.id;
      classYear.value = year.id;
    }
  }

  yearsTable.querySelectorAll('[data-current-year]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('POST', `/api/admin/academic-years/${button.dataset.currentYear}/set-current`);
        toast('Current academic year updated.', 'success');
        await loadAcademicSetup();
        await loadTerms();
        await loadClasses();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

async function loadTerms() {
  const result = await api('GET', '/api/admin/academic-years');
  const years = result.data || [];
  const container = document.querySelector('[data-terms-list]');

  container.innerHTML = years.map((year) => `
    <div class="term-row">
      <strong>${esc(year.name)}</strong>
      ${year.terms?.length
        ? year.terms.map((term) => `<div>${esc(term.name)} · ${statusBadge(term.isCurrent ? 'Current' : 'Not current')} <button type="button" class="secondary-button" data-current-term="${esc(term.id)}">Set current</button></div>`).join('')
        : '<small>No terms yet</small>'}
    </div>`).join('') || '<div class="empty-state">No academic years yet</div>';

  container.querySelectorAll('[data-current-term]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await api('POST', `/api/admin/terms/${button.dataset.currentTerm}/set-current`);
        toast('Current term updated.', 'success');
        await loadTerms();
      } catch (error) {
        toast(error.message, 'error');
      }
    });
  });
}

async function loadGrades() {
  const result = await api('GET', '/api/admin/grade-levels');
  const grades = result.data || [];
  document.querySelector('[data-grade-list]').innerHTML = grades.length
    ? grades.map((grade) => `<span class="grade-chip">${esc(grade.name)} · order ${esc(grade.sortOrder)}</span>`).join('')
    : '<div class="empty-state">No grade levels yet</div>';

  const select = document.querySelector('#class-grade');
  select.innerHTML = '<option value="">Select grade level</option>';
  for (const grade of grades) {
    const option = document.createElement('option');
    option.value = grade.id;
    option.textContent = grade.name;
    select.append(option);
  }
}

async function loadClasses() {
  const result = await api('GET', '/api/admin/classes');
  const classes = result.data || [];
  document.querySelector('[data-class-table]').innerHTML = classes.length
    ? classes.map((schoolClass) => `
      <tr><td>${esc(schoolClass.academicYearName || '')}</td><td>${esc(schoolClass.gradeLevelName || '')}</td><td><strong>${esc(schoolClass.name)}</strong></td></tr>`).join('')
    : '<tr><td colspan="3" class="empty-state">No classes yet</td></tr>';
}

async function refreshAll() {
  await loadAcademicSetup();
  await loadTerms();
  await loadGrades();
  await loadClasses();
}

document.querySelector('#year-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api('POST', '/api/admin/academic-years', {
      name: String(data.get('name')).trim(),
      startDate: String(data.get('startDate')),
      endDate: String(data.get('endDate')),
    });
    toast('Academic year added.', 'success');
    form.reset();
    await refreshAll();
  } catch (error) {
    toast(error.message, 'error');
  }
});

document.querySelector('#term-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const yearId = String(data.get('yearId'));
  try {
    await api('POST', `/api/admin/academic-years/${yearId}/terms`, {
      termNumber: Number(data.get('termNumber')),
      name: String(data.get('name')).trim(),
      startDate: String(data.get('startDate')),
      endDate: String(data.get('endDate')),
    });
    toast('Term added.', 'success');
    form.reset();
    await refreshAll();
  } catch (error) {
    toast(error.message, 'error');
  }
});

document.querySelector('#grade-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api('POST', '/api/admin/grade-levels', {
      name: String(data.get('name')).trim(),
      sortOrder: Number(data.get('sortOrder') || 0),
    });
    toast('Grade level added.', 'success');
    form.reset();
    await refreshAll();
  } catch (error) {
    toast(error.message, 'error');
  }
});

document.querySelector('#class-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  try {
    await api('POST', '/api/admin/classes', {
      academicYearId: String(data.get('academicYearId')),
      gradeLevelId: String(data.get('gradeLevelId')),
      name: String(data.get('name')).trim(),
    });
    toast('Class added.', 'success');
    form.reset();
    await refreshAll();
  } catch (error) {
    toast(error.message, 'error');
  }
});

async function start() {
  const user = await requireRole('admin');
  if (!user) return;
  await renderNav({ role: 'admin', username: user.username });
  await refreshAll();
}

start();
