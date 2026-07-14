const TYPE_LABELS = {
  youtube: 'YouTube / подкаст',
  reels: 'Reels / Shorts',
  ads: 'Реклама',
  event: 'Событие / свадьба',
  other: 'Другое',
};

const STATUS_LABELS = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  done: 'Закрыта',
};

let allOrders = [];
let currentFilter = 'all';
let selectedOrderId = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function truncate(str, len = 48) {
  if (!str || str.length <= len) return str || '';
  return `${str.slice(0, len)}…`;
}

function renderStats(stats) {
  document.getElementById('statAll').textContent = stats.total;
  document.getElementById('statPending').textContent = stats.pending;
  document.getElementById('statProgress').textContent = stats.inProgress;
  document.getElementById('statDone').textContent = stats.done;
}

function getFilteredOrders() {
  if (currentFilter === 'all') return allOrders;
  return allOrders.filter(o => o.status === currentFilter);
}

function renderClosedBy(order) {
  if (order.status !== 'done') return '';

  let text = 'Закрыта';
  let cls = 'closed-by-unknown';

  if (order.closedBy === 'user') {
    text = 'Закрыта клиентом';
    cls = 'closed-by-client';
  } else if (order.closedBy === 'admin') {
    const name = order.closedByName ? ` · ${order.closedByName}` : '';
    text = `Закрыта администратором${name}`;
    cls = 'closed-by-admin';
  }

  const date = order.closedAt
    ? `<span class="closed-by-date">${new Date(order.closedAt).toLocaleString('ru-RU')}</span>`
    : '';

  return `<div class="closed-by-info ${cls}"><span class="closed-by-badge">${escapeHtml(text)}</span>${date}</div>`;
}

function renderAuthor(msg) {
  if (msg.from === 'admin') {
    return `
      <span class="thread-author">
        <strong>${escapeHtml(msg.authorName || 'Админ')}</strong>
        <span class="admin-badge">администратор</span>
      </span>
    `;
  }
  return `<strong>${escapeHtml(msg.authorName || 'Клиент')}</strong>`;
}

function renderMessages(messages) {
  if (!messages?.length) {
    return '<p class="thread-empty">Сообщений в переписке пока нет</p>';
  }
  return `
    <div class="order-thread">
      ${messages.map(msg => `
        <div class="thread-msg thread-msg-${msg.from}">
          <div class="thread-msg-head">
            ${renderAuthor(msg)}
            <span class="thread-msg-time">${new Date(msg.createdAt).toLocaleString('ru-RU')}</span>
          </div>
          <p>${escapeHtml(msg.text)}</p>
        </div>
      `).join('')}
    </div>
  `;
}

function bindAdminDetailEvents(order) {
  const detail = document.getElementById('adminOrdersDetail');

  detail.querySelector('.admin-status-select')?.addEventListener('change', async e => {
    const id = e.target.dataset.id;
    try {
      const updated = await Auth.updateOrder(id, { status: e.target.value });
      const idx = allOrders.findIndex(o => o.id === id);
      if (idx !== -1) allOrders[idx] = updated;
      const stats = await Auth.getAdminStats();
      renderStats(stats);
      renderOrders();
    } catch (err) {
      alert(err.message);
      loadData();
    }
  });

  detail.querySelector('.save-reply-btn')?.addEventListener('click', async e => {
    const id = e.target.dataset.id;
    const textarea = detail.querySelector('.admin-reply-input');
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Отправка...';

    try {
      const updated = await Auth.updateOrder(id, { reply: textarea.value });
      textarea.value = '';
      const idx = allOrders.findIndex(o => o.id === id);
      if (idx !== -1) allOrders[idx] = updated;
      renderOrders();
    } catch (err) {
      alert(err.message);
    }

    btn.disabled = false;
    btn.textContent = 'Отправить ответ';
  });
}

function renderOrderDetail(order) {
  const detail = document.getElementById('adminOrdersDetail');
  if (!order) {
    detail.innerHTML = '<div class="orders-detail-empty"><p>Выберите обращение слева</p></div>';
    return;
  }

  const date = new Date(order.createdAt).toLocaleString('ru-RU');
  const client = order.name || 'Гость';
  const contact = order.contact || order.userEmail || '—';
  const isClosed = order.status === 'done';

  detail.innerHTML = `
    <div class="orders-detail-inner">
      <div class="orders-detail-head">
        <div>
          <h3 class="admin-detail-client">${escapeHtml(client)}</h3>
          <span class="admin-order-meta">${escapeHtml(TYPE_LABELS[order.type] || order.type)} · ${date}</span>
        </div>
        <select class="admin-status-select" data-id="${order.id}">
          <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Ожидает</option>
          <option value="in_progress" ${order.status === 'in_progress' ? 'selected' : ''}>В работе</option>
          <option value="done" ${order.status === 'done' ? 'selected' : ''}>Закрыть заявку</option>
        </select>
      </div>

      <div class="admin-order-contact">Контакт: <strong>${escapeHtml(contact)}</strong></div>

      <div class="order-topic">
        <span class="order-topic-label">Тема обращения</span>
        <p>${escapeHtml(order.message)}</p>
      </div>

      ${isClosed ? renderClosedBy(order) : ''}

      <div class="orders-detail-thread">
        <span class="order-thread-label">Переписка</span>
        ${renderMessages(order.messages)}
      </div>

      ${isClosed ? `
        <p class="orders-readonly-note">Заявка закрыта. Чтобы ответить — смените статус на «В работе».</p>
      ` : `
        <label class="form-field">
          <span>Ответ клиенту</span>
          <textarea class="admin-reply-input" data-id="${order.id}" rows="3" placeholder="Напишите ответ клиенту"></textarea>
        </label>
        <button type="button" class="btn btn-primary btn-sm save-reply-btn" data-id="${order.id}">Отправить ответ</button>
      `}
    </div>
  `;

  bindAdminDetailEvents(order);
}

function renderOrders() {
  const sidebar = document.getElementById('adminOrdersSidebar');
  const orders = getFilteredOrders();

  if (!orders.length) {
    sidebar.innerHTML = '';
    document.getElementById('adminOrdersDetail').innerHTML = '<p class="admin-empty">Заявок нет</p>';
    selectedOrderId = null;
    return;
  }

  if (!selectedOrderId || !orders.find(o => o.id === selectedOrderId)) {
    selectedOrderId = orders[0].id;
  }

  sidebar.innerHTML = orders.map(order => {
    const client = order.name || 'Гость';
    const active = order.id === selectedOrderId ? 'active' : '';
    const statusClass = order.status === 'done' ? 'status-done' : order.status === 'in_progress' ? 'status-progress' : 'status-pending';
    return `
      <button type="button" class="orders-sidebar-item ${active}" data-id="${order.id}">
        <div class="orders-sidebar-top">
          <span class="orders-sidebar-type">${escapeHtml(client)}</span>
          <span class="order-status ${statusClass}">${STATUS_LABELS[order.status] || order.status}</span>
        </div>
        <p class="orders-sidebar-preview">${escapeHtml(truncate(order.message, 56))}</p>
        <span class="orders-sidebar-date">${new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
      </button>
    `;
  }).join('');

  sidebar.querySelectorAll('.orders-sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedOrderId = btn.dataset.id;
      renderOrders();
    });
  });

  renderOrderDetail(orders.find(o => o.id === selectedOrderId));
}

async function loadData() {
  const [orders, stats] = await Promise.all([
    Auth.getAdminOrders(),
    Auth.getAdminStats(),
  ]);
  allOrders = orders;
  renderStats(stats);
  renderOrders();
}

async function initAdmin() {
  const ok = await Auth.requireAdmin();
  if (!ok) return;

  try {
    await loadData();
  } catch (err) {
    document.getElementById('adminOrdersSidebar').innerHTML = '';
    document.getElementById('adminOrdersDetail').innerHTML =
      `<p class="admin-empty">${escapeHtml(err.message)}</p>`;
  }

  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter;
      selectedOrderId = null;
      renderOrders();
    });
  });

  document.getElementById('refreshBtn').addEventListener('click', loadData);
}

initAdmin();