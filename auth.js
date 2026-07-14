const Auth = (() => {
  const TOKEN_KEY = 'framecut_token';
  const API = '/api';

  let cachedUser = null;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function request(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetch(`${API}${path}`, { ...options, headers });
    } catch {
      throw new Error('Сервер недоступен. Попробуйте позже.');
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        setToken(null);
        cachedUser = null;
      }
      throw new Error(data.error || 'Ошибка сервера');
    }
    return data;
  }

  async function register({ name, email, password }) {
    const data = await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setToken(data.token);
    cachedUser = data.user;
    return data.user;
  }

  async function login({ email, password }) {
    const data = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    cachedUser = data.user;
    return data.user;
  }

  function logout() {
    setToken(null);
    cachedUser = null;
  }

  async function fetchCurrentUser() {
    if (!getToken()) {
      cachedUser = null;
      return null;
    }
    try {
      const data = await request('/auth/me');
      cachedUser = data.user;
      return data.user;
    } catch {
      cachedUser = null;
      return null;
    }
  }

  function getCurrentUser() {
    return cachedUser;
  }

  async function updateProfile(updates) {
    const data = await request('/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    if (cachedUser) {
      cachedUser = { ...cachedUser, ...data.user };
    }
    return cachedUser;
  }

  async function addOrder(order) {
    const data = await request('/orders', {
      method: 'POST',
      body: JSON.stringify(order),
    });
    if (cachedUser) {
      cachedUser.orders = [data.order, ...(cachedUser.orders || [])];
    }
    return data.order;
  }

  function getInitials(name) {
    return name
      .split(' ')
      .map(w => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  async function requireAuth(redirectTo = 'login.html') {
    const user = await fetchCurrentUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'dashboard.html');
      window.location.href = `${redirectTo}?next=${next}`;
      return false;
    }
    return true;
  }

  function isAdmin() {
    return cachedUser?.role === 'admin';
  }

  async function requireAdmin(redirectTo = 'login.html') {
    const user = await fetchCurrentUser();
    if (!user) {
      const next = encodeURIComponent(window.location.pathname.split('/').pop() || 'admin.html');
      window.location.href = `${redirectTo}?next=${next}`;
      return false;
    }
    if (user.role !== 'admin') {
      window.location.href = 'dashboard.html';
      return false;
    }
    return true;
  }

  async function getAdminOrders() {
    const data = await request('/admin/orders');
    return data.orders;
  }

  async function getAdminStats() {
    return request('/admin/stats');
  }

  async function updateOrder(id, updates) {
    const data = await request(`/admin/orders/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return data.order;
  }

  async function replyToOrder(id, message) {
    const data = await request(`/orders/${id}/reply`, {
      method: 'POST',
      body: JSON.stringify({ message }),
    });
    if (cachedUser?.orders) {
      const idx = cachedUser.orders.findIndex(o => o.id === id);
      if (idx !== -1) cachedUser.orders[idx] = data.order;
    }
    return data.order;
  }

  async function closeOrder(id) {
    const data = await request(`/orders/${id}/close`, { method: 'PATCH' });
    if (cachedUser?.orders) {
      const idx = cachedUser.orders.findIndex(o => o.id === id);
      if (idx !== -1) cachedUser.orders[idx] = data.order;
    }
    return data.order;
  }

  async function init() {
    await fetchCurrentUser();
  }

  return {
    init,
    register,
    login,
    logout,
    fetchCurrentUser,
    getCurrentUser,
    updateProfile,
    addOrder,
    getInitials,
    isAdmin,
    requireAuth,
    requireAdmin,
    getAdminOrders,
    getAdminStats,
    updateOrder,
    replyToOrder,
    closeOrder,
  };
})();