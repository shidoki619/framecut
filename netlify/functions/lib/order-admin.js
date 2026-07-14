const store = require('./store');

const STATUS_LABELS = {
  pending: 'Ожидает',
  in_progress: 'В работе',
  done: 'Закрыта',
};

const TYPE_LABELS = {
  youtube: 'YouTube / подкаст',
  reels: 'Reels / Shorts',
  ads: 'Реклама',
  event: 'Событие / свадьба',
  other: 'Другое',
};

async function findOrderByRef(ref) {
  if (!ref) return null;
  const clean = ref.trim().toLowerCase();
  const orders = await store.listOrders();
  const exact = orders.find(o => o.id === clean);
  if (exact) return exact;
  const matches = orders.filter(o => o.id.startsWith(clean));
  if (matches.length === 1) return matches[0];
  return null;
}

async function setOrderStatus(order, status, adminName = 'Egor') {
  if (status === 'done') {
    if (order.status !== 'done') {
      order.status = 'done';
      order.closedBy = 'admin';
      order.closedByName = adminName;
      order.closedAt = new Date().toISOString();
    }
  } else if (order.status === 'done') {
    order.status = status;
    order.closedBy = null;
    order.closedByName = '';
    order.closedAt = null;
  } else {
    order.status = status;
  }
  await store.saveOrder(order);
  return order;
}

function formatOrderBrief(order, index) {
  const type = TYPE_LABELS[order.type] || order.type;
  const status = STATUS_LABELS[order.status] || order.status;
  const prefix = index != null ? `${index}. ` : '';
  return `${prefix}<b>${order.name || 'Гость'}</b> · ${type}\n📌 ${status} · ${order.contact || '—'}\n<code>${order.id}</code>`;
}

module.exports = {
  STATUS_LABELS,
  findOrderByRef,
  setOrderStatus,
  formatOrderBrief,
};