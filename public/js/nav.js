import { api } from './api.js';

export async function renderNav(options = {}) {
  const { role, username, schoolName } = options;
  const header = document.querySelector('[data-app-nav]');
  if (!header) return;

  if (role === 'admin') {
    const links = [
      ['Dashboard', '/admin/'],
      ['Payments', '/admin/payments.html'],
      ['Balances', '/admin/balances.html'],
      ['Students', '/admin/students.html'],
      ['Fees & Billing', '/admin/fees.html'],
      ['Setup', '/admin/setup.html'],
    ];
    header.innerHTML = `
      <a class="brand" href="/admin/">School ERP</a>
      <nav class="nav-links" aria-label="Admin navigation"></nav>
      <div class="nav-user"><span></span><button type="button" data-logout>Log out</button></div>`;
    const nav = header.querySelector('.nav-links');
    for (const [label, href] of links) {
      const link = document.createElement('a');
      link.href = href;
      link.textContent = label;
      if (window.location.pathname === href) link.classList.add('active');
      nav.append(link);
    }
    header.querySelector('.nav-user span').textContent = username || '';
  } else {
    header.innerHTML = `
      <a class="brand" href="/student/">${schoolName || 'School ERP'}</a>
      <div class="nav-user"><button type="button" data-logout>Log out</button></div>`;
  }

  header.querySelector('[data-logout]').addEventListener('click', async () => {
    try {
      await api('POST', '/api/auth/logout');
    } finally {
      window.location.href = '/';
    }
  });
}
