export function esc(text) {
  const value = String(text ?? '');
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatKES(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'KES 0.00';
  return `KES ${number.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(new Date(iso));
}

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('en-KE', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

export function statusBadge(status) {
  const label = String(status || 'Unknown');
  const normalized = label.toLowerCase();
  const className = ['paid', 'valid', 'active', 'current', 'cleared'].includes(normalized)
    ? 'success'
    : ['partial', 'pending', 'on_leave'].includes(normalized)
      ? 'warning'
      : 'danger';
  return `<span class="badge badge-${className}">${esc(label[0].toUpperCase() + label.slice(1))}</span>`;
}

export function toast(message, type = 'success') {
  let region = document.querySelector('[data-toast-region]');
  if (!region) {
    region = document.createElement('div');
    region.dataset.toastRegion = '';
    region.className = 'toast-region';
    document.body.append(region);
  }
  const item = document.createElement('div');
  item.className = `toast toast-${type}`;
  item.textContent = message;
  region.append(item);
  setTimeout(() => item.remove(), 5000);
}

export function showFormError(formEl, error) {
  let box = formEl.querySelector('[data-form-error]');
  if (!box) {
    box = document.createElement('div');
    box.dataset.formError = '';
    box.className = 'form-error';
    formEl.prepend(box);
  }
  box.textContent = error?.message || 'Request failed';

  for (const issue of error?.details || []) {
    const fieldName = issue.path?.[0];
    if (!fieldName) continue;
    const field = formEl.elements.namedItem(fieldName);
    if (field) field.setAttribute('aria-describedby', `${fieldName}-error`);
  }
}

export function setBusy(button, isBusy) {
  if (isBusy) {
    button.dataset.originalText = button.textContent;
    button.disabled = true;
    button.textContent = 'Please wait...';
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || button.textContent;
  }
}

export function debounce(fn, ms = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), ms);
  };
}

export function confirmDialog(message) {
  return window.confirm(message);
}

export function openModal({ title, content, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.innerHTML = `<div class="modal-card"><div class="modal-header"><h2></h2><button type="button" class="icon-button" data-close aria-label="Close">&times;</button></div><div class="modal-body"></div></div>`;
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('.modal-body').append(content);
  document.body.append(dialog);

  const closeButton = dialog.querySelector('[data-close]');
  const previousFocus = document.activeElement;
  const close = () => {
    dialog.close();
    dialog.remove();
    previousFocus?.focus();
    onClose?.();
  };
  closeButton.addEventListener('click', close);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close();
  });
  dialog.showModal();
  closeButton.focus();
  return close;
}

export function renderPagination(container, { page, limit, total }, onChange) {
  const pageCount = Math.max(1, Math.ceil(total / limit));
  container.innerHTML = '';
  const previous = document.createElement('button');
  previous.type = 'button';
  previous.textContent = 'Previous';
  previous.disabled = page <= 1;
  previous.addEventListener('click', () => onChange(page - 1));
  const label = document.createElement('span');
  label.textContent = `Page ${page} of ${pageCount}`;
  const next = document.createElement('button');
  next.type = 'button';
  next.textContent = 'Next';
  next.disabled = page >= pageCount;
  next.addEventListener('click', () => onChange(page + 1));
  container.append(previous, label, next);
}
