import { api } from '../api.js';
import { setBusy, showFormError } from '../ui.js';

const form = document.querySelector('#change-password-form');
const button = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const newPassword = String(formData.get('newPassword') || '');
  const confirmPassword = String(formData.get('confirmPassword') || '');

  if (newPassword !== confirmPassword) {
    showFormError(form, { message: 'New password and confirmation do not match.' });
    return;
  }

  setBusy(button, true);
  try {
    const data = await api('POST', '/api/auth/change-password', {
      currentPassword: String(formData.get('currentPassword') || ''),
      newPassword,
    });

    const role = data.user.role;
    window.location.href = role === 'admin' ? '/admin/' : '/student/';
  } catch (error) {
    showFormError(form, error);
  } finally {
    setBusy(button, false);
  }
});

document.querySelector('#logout-link').addEventListener('click', async (event) => {
  event.preventDefault();
  try {
    await api('POST', '/api/auth/logout');
  } finally {
    window.location.href = '/';
  }
});
