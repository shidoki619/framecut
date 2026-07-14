const crypto = require('crypto');
const { getStore } = require('@netlify/blobs');

function emptyDb() {
  return { users: {}, usersByEmail: {}, orders: {}, orderIds: [], telegramMap: {} };
}

async function blob() {
  const opts = { name: 'framecut-data', consistency: 'strong' };
  const siteID = process.env.SITE_ID || process.env.NETLIFY_SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN || process.env.NETLIFY_TOKEN;
  if (siteID && token) {
    opts.siteID = siteID;
    opts.token = token;
  }
  return getStore(opts);
}

async function readDb() {
  const store = await blob();
  const raw = await store.get('db');
  return raw ? JSON.parse(raw) : emptyDb();
}

async function writeDb(db) {
  const store = await blob();
  await store.set('db', JSON.stringify(db));
}

function id() {
  return crypto.randomUUID();
}

function now() {
  return new Date().toISOString();
}

function getThreadMessages(order) {
  const userMsgs = [];
  const adminByText = new Map();
  for (const m of order.messages || []) {
    if (m.from === 'user' && m.text === order.message) continue;
    const entry = {
      from: m.from,
      text: m.text,
      authorName: m.authorName || (m.from === 'admin' ? 'Админ' : 'Клиент'),
      createdAt: m.createdAt,
    };
    if (m.from === 'admin') {
      const existing = adminByText.get(m.text);
      if (!existing || (existing.authorName === 'Админ' && entry.authorName !== 'Админ')) {
        adminByText.set(m.text, entry);
      }
      continue;
    }
    userMsgs.push(entry);
  }
  return [...userMsgs, ...adminByText.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

function publicOrder(order) {
  const base = {
    id: order.id,
    type: order.type,
    message: order.message,
    contact: order.contact,
    status: order.status,
    closed: order.status === 'done',
    messages: getThreadMessages(order),
    createdAt: order.createdAt,
  };
  if (order.status === 'done') {
    base.closedBy = order.closedBy;
    base.closedByName = order.closedByName;
    base.closedAt = order.closedAt;
  }
  return base;
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    telegram: user.telegram || '',
    avatar: user.avatar || null,
    role: user.role || 'user',
    createdAt: user.createdAt,
  };
}

async function findUserByEmail(email) {
  const db = await readDb();
  const uid = db.usersByEmail[email?.toLowerCase()];
  return uid ? db.users[uid] : null;
}

async function findUserById(userId) {
  const db = await readDb();
  return db.users[userId] || null;
}

async function createUser({ name, email, password, role }) {
  const db = await readDb();
  const userId = id();
  const ts = now();
  db.users[userId] = {
    id: userId,
    name,
    email,
    password,
    telegram: '',
    avatar: null,
    role: role || 'user',
    createdAt: ts,
    updatedAt: ts,
  };
  db.usersByEmail[email] = userId;
  await writeDb(db);
  return db.users[userId];
}

async function updateUser(userId, patch) {
  const db = await readDb();
  const user = db.users[userId];
  if (!user) return null;
  Object.assign(user, patch, { updatedAt: now() });
  await writeDb(db);
  return user;
}

async function listOrders(filter = {}) {
  const db = await readDb();
  let orders = db.orderIds.map(oid => db.orders[oid]).filter(Boolean);
  if (filter.userId) orders = orders.filter(o => o.userId === filter.userId);
  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return orders;
}

async function findOrder(orderId) {
  const db = await readDb();
  return db.orders[orderId] || null;
}

async function saveOrder(order) {
  const db = await readDb();
  order.updatedAt = now();
  db.orders[order.id] = order;
  if (!db.orderIds.includes(order.id)) db.orderIds.unshift(order.id);
  await writeDb(db);
  return order;
}

async function createOrder(data) {
  const ts = now();
  const order = {
    id: id(),
    userId: data.userId || null,
    name: data.name || '',
    contact: data.contact || '',
    type: data.type,
    message: data.message,
    status: 'pending',
    messages: [],
    closedBy: null,
    closedByName: '',
    closedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  return saveOrder(order);
}

async function countOrders(status) {
  const db = await readDb();
  const orders = Object.values(db.orders);
  return status ? orders.filter(o => o.status === status).length : orders.length;
}

async function linkTelegramMessage(messageId, orderId) {
  const db = await readDb();
  if (!db.telegramMap) db.telegramMap = {};
  db.telegramMap[String(messageId)] = orderId;
  await writeDb(db);
}

async function getOrderIdByTelegramMessage(messageId) {
  const db = await readDb();
  return db.telegramMap?.[String(messageId)] || null;
}

module.exports = {
  readDb,
  publicUser,
  publicOrder,
  findUserByEmail,
  findUserById,
  createUser,
  updateUser,
  listOrders,
  findOrder,
  saveOrder,
  createOrder,
  countOrders,
  linkTelegramMessage,
  getOrderIdByTelegramMessage,
};