function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderNavAuth() {
  const container = document.getElementById('navAuth');
  const mobileMenu = document.querySelector('.mobile-menu');
  if (!container) return;

  const user = Auth.getCurrentUser();

  if (user) {
    const avatarHtml = user.avatar
      ? `<img src="${user.avatar}" alt="" class="user-avatar-img">`
      : `<span class="user-avatar-initials">${escapeHtml(Auth.getInitials(user.name))}</span>`;

    container.innerHTML = `
      <div class="user-menu">
        <button type="button" class="user-menu-trigger" id="userMenuTrigger" aria-label="Меню профиля">
          <span class="user-avatar">${avatarHtml}</span>
          <span class="user-name">${escapeHtml(user.name.split(' ')[0])}</span>
          <svg class="user-chevron" width="12" height="12" viewBox="0 0 12 12"><path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <div class="user-dropdown-head">
            <span class="user-avatar user-avatar-lg">${avatarHtml}</span>
            <div>
              <strong>${escapeHtml(user.name)}</strong>
              <span>${escapeHtml(user.email)}</span>
            </div>
          </div>
          <a href="dashboard.html" class="user-dropdown-link">Личный кабинет</a>
          <a href="dashboard.html#orders" class="user-dropdown-link">Мои заявки</a>
          ${user.role === 'admin' ? '<a href="admin.html" class="user-dropdown-link admin-link">Админ-панель</a>' : ''}
          <button type="button" class="user-dropdown-link user-dropdown-logout" id="logoutBtn">Выйти</button>
        </div>
      </div>
    `;

    document.getElementById('userMenuTrigger')?.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('userDropdown')?.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      document.getElementById('userDropdown')?.classList.remove('open');
    });

    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      Auth.logout();
      window.location.href = 'index.html';
    });

    if (mobileMenu) {
      mobileMenu.querySelectorAll('.mobile-auth').forEach(el => el.remove());
      const link = document.createElement('a');
      link.href = 'dashboard.html';
      link.className = 'mobile-auth';
      link.textContent = `Кабинет · ${user.name}`;
      mobileMenu.appendChild(link);
      if (user.role === 'admin') {
        const adminLink = document.createElement('a');
        adminLink.href = 'admin.html';
        adminLink.className = 'mobile-auth';
        adminLink.textContent = 'Админ-панель';
        mobileMenu.appendChild(adminLink);
      }
    }
  } else {
    container.innerHTML = `
      <a href="login.html" class="btn btn-ghost btn-sm nav-login">Войти</a>
      <a href="register.html" class="btn btn-primary btn-sm">Регистрация</a>
    `;

    if (mobileMenu) {
      mobileMenu.querySelectorAll('.mobile-auth').forEach(el => el.remove());
      const login = document.createElement('a');
      login.href = 'login.html';
      login.className = 'mobile-auth';
      login.textContent = 'Войти';
      const reg = document.createElement('a');
      reg.href = 'register.html';
      reg.className = 'mobile-auth';
      reg.textContent = 'Регистрация';
      mobileMenu.append(login, reg);
    }
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await Auth.init();
  renderNavAuth();
});