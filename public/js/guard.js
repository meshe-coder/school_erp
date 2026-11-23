import { api } from './api.js';

export async function requireRole(role) {
  try {
    const data = await api('GET', '/api/auth/me');
    const user = data.user;

    if (!user) {
      window.location.href = '/';
      return null;
    }
    if (user.must_change_password) {
      window.location.href = '/change-password.html';
      return null;
    }
    if (user.role !== role) {
      window.location.href = user.role === 'admin' ? '/admin/' : '/student/';
      return null;
    }

    document.body.hidden = false;
    return user;
  } catch (error) {
    if (error.status === 401 || error.status === 403) {
      window.location.href = '/';
    }
    return null;
  }
}
