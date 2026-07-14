const TYPE_LABELS = {
  youtube: 'YouTube / подкаст',
  reels: 'Reels / Shorts',
  ads: 'Реклама',
  event: 'Событие / свадьба',
  other: 'Другое',
};

const STATUS_LABELS = {
  pending: { text: 'Ожидает', class: 'status-pending' },
  in_progress: { text: 'В работе', class: 'status-progress' },
  done: { text: 'Закрыта', class: 'status-done' },
};

let currentUser = null;
let selectedOrderId = null;
let pendingCloseOrderId = null;
let orderPollTimer = null;

const closeModal = document.getElementById('closeOrderModal');
const closeModalConfirm = document.getElementById('closeModalConfirm');
const closeModalCancel = document.getElementById('closeModalCancel');
const closeModalError = document.getElementById('closeModalError');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function truncate(str, len = 48) {
  if (!str || str.length <= len) return str || '';
  return `${str.slice(0, len)}…`;
}

function openCloseModal(orderId) {
  pendingCloseOrderId = orderId;
  closeModalError.textContent = '';
  closeModalConfirm.disabled = false;
  closeModalConfirm.textContent = 'Закрыть заявку';
  closeModal.classList.add('modal-open');
  closeModal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
}

function closeCloseModal() {
  pendingCloseOrderId = null;
  closeModal.classList.remove('modal-open');
  closeModal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

closeModalCancel?.addEventListener('click', closeCloseModal);
closeModal?.querySelector('[data-close-modal]')?.addEventListener('click', closeCloseModal);

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && closeModal?.classList.contains('modal-open')) {
    closeCloseModal();
  }
});

closeModalConfirm?.addEventListener('click', async () => {
  if (!pendingCloseOrderId) return;
  closeModalConfirm.disabled = true;
  closeModalConfirm.textContent = 'Закрытие...';
  try {
    const updated = await Auth.closeOrder(pendingCloseOrderId);
    const idx = currentUser.orders.findIndex(o => o.id === pendingCloseOrderId);
    if (idx !== -1) currentUser.orders[idx] = updated;
    selectedOrderId = updated.id;
    closeCloseModal();
    renderOrders(currentUser);
  } catch (err) {
    closeModalError.textContent = err.message;
    closeModalConfirm.disabled = false;
    closeModalConfirm.textContent = 'Закрыть заявку';
  }
});

function renderClosedBy(order, perspective = 'client') {
  if (order.status !== 'done' && !order.closed) return '';

  let text = 'Закрыта';
  let cls = 'closed-by-unknown';

  if (order.closedBy === 'user') {
    text = perspective === 'client' ? 'Закрыта вами' : 'Закрыта клиентом';
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
  return `<strong>${escapeHtml(msg.authorName || 'Вы')}</strong>`;
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

function renderAvatar(user) {
  const wrap = document.getElementById('profileAvatar');
  const initialsEl = document.getElementById('avatarInitials');
  const removeBtn = document.getElementById('removeAvatarBtn');

  wrap.querySelector('img')?.remove();

  if (user.avatar) {
    const img = document.createElement('img');
    img.src = user.avatar;
    img.alt = user.name;
    img.className = 'user-avatar-img';
    wrap.prepend(img);
    initialsEl.style.display = 'none';
    removeBtn.hidden = false;
  } else {
    initialsEl.textContent = Auth.getInitials(user.name);
    initialsEl.style.display = 'flex';
    removeBtn.hidden = true;
  }
}

function fillProfile(user) {
  document.getElementById('profileName').value = user.name;
  document.getElementById('profileEmail').value = user.email;
  document.getElementById('profileTelegram').value = user.telegram || '';
  document.getElementById('memberSince').textContent = new Date(user.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  renderAvatar(user);
}

function bindDetailEvents() {
  const form = document.querySelector('.order-reply-form');
  form?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = form.dataset.id;
    const textarea = form.querySelector('textarea');
    const btn = form.querySelector('button[type="submit"]');
    const text = textarea.value.trim();
    if (!text) return;

    btn.disabled = true;
    btn.textContent = 'Отправка...';

    try {
      const updated = await Auth.replyToOrder(id, text);
      const idx = currentUser.orders.findIndex(o => o.id === id);
      if (idx !== -1) currentUser.orders[idx] = updated;
      renderOrders(currentUser);
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = 'Отправить';
    }
  });

  document.querySelector('.btn-close-order')?.addEventListener('click', () => {
    openCloseModal(selectedOrderId);
  });
}

function renderOrderDetail(order) {
  const detail = document.getElementById('ordersDetail');
  if (!order) {
    detail.innerHTML = '<div class="orders-detail-empty"><p>Выберите обращение слева</p></div>';
    return;
  }

  const status = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
  const isClosed = order.status === 'done' || order.closed;
  const date = new Date(order.createdAt).toLocaleDateString('ru-RU');

  detail.innerHTML = `
    <div class="orders-detail-inner">
      <div class="orders-detail-head">
        <div>
          <span class="order-type">${TYPE_LABELS[order.type] || order.type}</span>
          <span class="order-status ${status.class}">${status.text}</span>
        </div>
        <span class="order-date">Создана: ${date}</span>
      </div>

      <div class="order-topic">
        <span class="order-topic-label">Тема обращения</span>
        <p>${escapeHtml(order.message)}</p>
      </div>

      ${isClosed ? renderClosedBy(order, 'client') : ''}

      <div class="orders-detail-thread">
        <span class="order-thread-label">Переписка</span>
        ${renderMessages(order.messages)}
      </div>

      ${isClosed ? `
        <p class="orders-readonly-note">Заявка закрыта — переписку можно читать, но отправить сообщение нельзя.</p>
      ` : `
        <form class="order-reply-form" data-id="${order.id}">
          <label class="form-field">
            <span>Ваш ответ</span>
            <textarea rows="3" placeholder="Напишите уточнение или вопрос..." required></textarea>
          </label>
          <div class="order-footer">
            <button type="submit" class="btn btn-primary btn-sm">Отправить</button>
            <button type="button" class="btn-close-order">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5"/>
                <path d="M15 9l-6 6M9 9l6 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              Закрыть заявку
            </button>
          </div>
        </form>
      `}
    </div>
  `;

  bindDetailEvents();
}

function renderOrders(user) {
  const sidebar = document.getElementById('ordersSidebar');
  const count = document.getElementById('ordersCount');
  const orders = user.orders || [];

  count.textContent = orders.length;
  document.getElementById('statTotal').textContent = orders.length;
  document.getElementById('statPending').textContent = orders.filter(o => o.status === 'pending').length;
  document.getElementById('statDone').textContent = orders.filter(o => o.status === 'done').length;

  if (!orders.length) {
    sidebar.innerHTML = '';
    document.getElementById('ordersDetail').innerHTML = `
      <div class="orders-empty">
        <p>Заявок пока нет</p>
        <a href="index.html#contact">Отправить первую заявку →</a>
      </div>
    `;
    selectedOrderId = null;
    return;
  }

  if (!selectedOrderId || !orders.find(o => o.id === selectedOrderId)) {
    selectedOrderId = orders[0].id;
  }

  sidebar.innerHTML = orders.map(order => {
    const status = STATUS_LABELS[order.status] || STATUS_LABELS.pending;
    const active = order.id === selectedOrderId ? 'active' : '';
    return `
      <button type="button" class="orders-sidebar-item ${active}" data-id="${order.id}">
        <div class="orders-sidebar-top">
          <span class="orders-sidebar-type">${TYPE_LABELS[order.type] || order.type}</span>
          <span class="order-status ${status.class}">${status.text}</span>
        </div>
        <p class="orders-sidebar-preview">${escapeHtml(truncate(order.message, 56))}</p>
        <span class="orders-sidebar-date">${new Date(order.createdAt).toLocaleDateString('ru-RU')}</span>
      </button>
    `;
  }).join('');

  sidebar.querySelectorAll('.orders-sidebar-item').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedOrderId = btn.dataset.id;
      renderOrders(user);
    });
  });

  const selected = orders.find(o => o.id === selectedOrderId);
  renderOrderDetail(selected);
}

function compressImage(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const ratio = Math.min(maxSize / width, maxSize / height, 1);
        width *= ratio;
        height *= ratio;
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function startOrderPolling() {
  stopOrderPolling();
  orderPollTimer = setInterval(async () => {
    if (!currentUser) return;
    try {
      const fresh = await Auth.fetchCurrentUser();
      const prevSelected = currentUser.orders?.find(o => o.id === selectedOrderId);
      const nextSelected = fresh.orders?.find(o => o.id === selectedOrderId);
      const changed =
        (currentUser.orders?.length || 0) !== (fresh.orders?.length || 0) ||
        prevSelected?.status !== nextSelected?.status ||
        (prevSelected?.messages?.length || 0) !== (nextSelected?.messages?.length || 0);

      if (changed) {
        currentUser = fresh;
        renderOrders(currentUser);
      }
    } catch {
      /* ignore polling errors */
    }
  }, 8000);
}

function stopOrderPolling() {
  if (orderPollTimer) {
    clearInterval(orderPollTimer);
    orderPollTimer = null;
  }
}

async function initDashboard() {
  const ok = await Auth.requireAuth();
  if (!ok) return;

  currentUser = await Auth.fetchCurrentUser();
  fillProfile(currentUser);
  renderOrders(currentUser);
  startOrderPolling();

  document.getElementById('avatarInput').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 5 МБ.');
      return;
    }
    try {
      const avatar = await compressImage(file);
      currentUser = await Auth.updateProfile({ avatar });
      renderAvatar(currentUser);
      renderNavAuth();
    } catch (err) {
      alert(err.message || 'Не удалось загрузить изображение.');
    }
    e.target.value = '';
  });

  document.getElementById('removeAvatarBtn').addEventListener('click', async () => {
    try {
      currentUser = await Auth.updateProfile({ avatar: null });
      renderAvatar(currentUser);
      renderNavAuth();
    } catch (err) {
      alert(err.message);
    }
  });

  document.getElementById('profileForm').addEventListener('submit', async e => {
    e.preventDefault();
    const note = document.getElementById('profileNote');
    const form = e.target;
    try {
      currentUser = await Auth.updateProfile({
        name: form.name.value,
        telegram: form.telegram.value,
      });
      renderAvatar(currentUser);
      renderNavAuth();
      note.textContent = 'Профиль сохранён';
      setTimeout(() => { note.textContent = ''; }, 3000);
    } catch (err) {
      note.textContent = err.message;
      note.classList.remove('success');
    }
  });

  const burger = document.querySelector('.burger');
  const mobileMenu = document.querySelector('.mobile-menu');
  burger?.addEventListener('click', () => mobileMenu?.classList.toggle('open'));
}

initDashboard();