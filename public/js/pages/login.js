import { api } from '../api.js';
import { setBusy, showFormError } from '../ui.js';

async function loadConfig() {
  try {
    const config = await api('GET', '/api/config');
    document.querySelectorAll('[data-school-name]').forEach((element) => {
      element.textContent = config.schoolName;
    });
  } catch (_) {
    document.querySelectorAll('[data-school-name]').forEach((element) => {
      element.textContent = 'My School';
    });
  }
}

async function checkExistingSession() {
  try {
    const data = await api('GET', '/api/auth/me');
    const user = data.user;
    if (!user) return;
    if (user.must_change_password) {
      window.location.href = '/change-password.html';
    } else if (user.role === 'admin') {
      window.location.href = '/admin/';
    } else if (user.role === 'student') {
      window.location.href = '/student/';
    }
  } catch (_) {
    // No valid session: keep login form visible.
  }
}

const form = document.querySelector('#login-form');
const button = form.querySelector('button[type="submit"]');

form.addEventListener('submit', async (event) => {
  event.preventEvent?.();
  event.preventDefault();
  setBusy(button, true);

  const formData = new FormData(form);
  try {
    const data = await api('POST', '/api/auth/login', {
      username: String(formData.get('username') || '').trim(),
      password: String(formData.get('password') || ''),
    });

    const user = data.user;
    if (user.role === 'teacher') {
      try {
        await api('POST', '/api/auth/logout');
      } catch (_) {}
      showFormError(form, { message: 'Teacher accounts do not have a portal yet.' });
      return;
    }

    if (user.must_change_password) {
      window.location.href = '/change-password.html';
    } else if (user.role === 'admin') {
      window.location.href = '/admin/';
    } else {
      window.location.href = '/student/';
    }
  } catch (error) {
    if (error.status === 401) {
      showFormError(form, { message: 'Invalid username or password' });
    } else if (error.status === 429) {
      showFormError(form, { message: 'Too many attempts. Please wait a few minutes and try again.' });
    } else {
      showFormError(form, error);
    }
  } finally {
    setBusy(button, false);
  }
});

const passwordInput = document.querySelector('#password');
const toggle = document.querySelector('#toggle-password');
toggle.addEventListener('click', () => {
  const show = passwordInput.type === 'password';
  passwordInput.type = show ? 'text' : 'password';
  toggle.textContent = show ? 'Hide' : 'Show';
});

loadConfig();
checkExistingSession();
