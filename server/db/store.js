const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getThreadMessages } = require('../lib/orders');

const isNetlify = Boolean(process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_FILE = path.join(__dirname, '..', 'data', 'db.json');

let cache = null;
let blobStore = null;

function emptyDb() {
  return { users: {}, usersByEmail: {}, orders: {}, orderIds: [] };
}

function loadFileDb() {
  if (cache) return cache;
  try {
    if (fs.existsSync(DATA_FILE)) {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      return cache;
    }
  } catch {
    /* fresh db */
  }
  cache = emptyDb();
  return cache;
}

function saveFileDb() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(cache, null, 2));
}

async function getBlobStore() {
  if (!blobStore) {
    const { getStore } = await import('@netlify/blobs');
    blobStore = getStore({ name: 'framecut-data', consistency: 'strong' });
  }
  return blobStore;
}

async function readDb() {
  if (isNetlify) {
    const store = await getBlobStore();
    const raw = await store.get('db');
    return raw ? JSON.parse(raw) : emptyDb();
  }
  return loadFileDb();
}

async function writeDb(db) {
  if (isNetlify) {
    const store = await getBlobStore();
    await store.set('db', JSON.stringify(db));
    return;
  }
  cache = db;
  saveFileDb();
}

function newId() {
  return crypto.randomUUID();
}

function nowIso() {
  return new Date().toISOString();
}

function hydrateUser(row, db, persist) {
  const user = {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    password: row.password,
    telegram: row.telegram || '',
    avatar: row.avatar || null,
    role: row.role || 'user',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    async save() {
      db.users[row.id] = {
        id: row.id,
        name: user.name,
        email: user.email,
        password: user.password,
        telegram: user.telegram,
        avatar: user.avatar,
        role: user.role,
        createdAt: row.createdAt,
        updatedAt: nowIso(),
      };
      db.usersByEmail[user.email] = row.id;
      await persist();
      return user;
    },
    toPublic() {
      return {
        id: row.id,
        name: user.name,
        email: user.email,
        telegram: user.telegram,
        avatar: user.avatar,
        role: user.role,
        createdAt: user.createdAt,
      };
    },
  };
  return user;
}

function hydrateOrder(row, db, persist) {
  const order = {
    _id: row.id,
    id: row.id,
    userId: row.userId || null,
    name: row.name || '',
    contact: row.contact || '',
    type: row.type,
    message: row.message,
    status: row.status,
    messages: row.messages || [],
    closedBy: row.closedBy || null,
    closedByName: row.closedByName || '',
    closedAt: row.closedAt || null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    async save() {
      db.orders[row.id] = {
        id: row.id,
        userId: order.userId,
        name: order.name,
        contact: order.contact,
        type: order.type,
        message: order.message,
        status: order.status,
        messages: order.messages,
        closedBy: order.closedBy,
        closedByName: order.closedByName,
        closedAt: order.closedAt,
        createdAt: row.createdAt,
        updatedAt: nowIso(),
      };
      if (!db.orderIds.includes(row.id)) db.orderIds.unshift(row.id);
      await persist();
      return order;
    },
    toPublic() {
      return {
        id: row.id,
        type: order.type,
        message: order.message,
        contact: order.contact,
        status: order.status,
        closed: order.status === 'done',
        messages: getThreadMessages(order),
        createdAt: order.createdAt,
        ...(order.status === 'done'
          ? {
              closedBy: order.closedBy,
              closedByName: order.closedByName,
              closedAt: order.closedAt,
            }
          : {}),
      };
    },
    toAdmin(user) {
      return {
        ...order.toPublic(),
        name: order.name,
        userEmail: user?.email || null,
        userId: order.userId || null,
      };
    },
    close(by, name) {
      order.status = 'done';
      order.closedBy = by;
      order.closedByName = name || '';
      order.closedAt = new Date().toISOString();
    },
    clearClose() {
      order.closedBy = null;
      order.closedByName = '';
      order.closedAt = null;
    },
    addMessage({ from, text, authorName }) {
      order.messages.push({
        id: newId(),
        from,
        text,
        authorName: authorName || '',
        createdAt: new Date().toISOString(),
      });
    },
  };
  return order;
}

async function withDb(fn) {
  const db = await readDb();
  const persist = () => writeDb(db);
  return fn(db, persist);
}

async function initStore() {
  await readDb();
}

async function findUserById(id) {
  return withDb(async (db, persist) => {
    const row = db.users[id];
    return row ? hydrateUser(row, db, persist) : null;
  });
}

async function findUserByEmail(email) {
  return withDb(async (db, persist) => {
    const id = db.usersByEmail[email?.toLowerCase()];
    const row = id ? db.users[id] : null;
    return row ? hydrateUser(row, db, persist) : null;
  });
}

async function createUser(data) {
  return withDb(async (db, persist) => {
    const id = newId();
    const ts = nowIso();
    const row = {
      id,
      name: data.name,
      email: data.email,
      password: data.password,
      telegram: data.telegram || '',
      avatar: data.avatar || null,
      role: data.role || 'user',
      createdAt: ts,
      updatedAt: ts,
    };
    db.users[id] = row;
    db.usersByEmail[data.email] = id;
    await persist();
    return hydrateUser(row, db, persist);
  });
}

async function findUsersByIds(ids) {
  return withDb(async (db, persist) => {
    return ids.map(id => db.users[id]).filter(Boolean).map(row => hydrateUser(row, db, persist));
  });
}

async function findOrders(filter = {}) {
  return withDb(async (db, persist) => {
    let rows = db.orderIds.map(id => db.orders[id]).filter(Boolean);
    if (filter.userId) rows = rows.filter(o => o.userId === filter.userId);
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return rows.map(row => hydrateOrder(row, db, persist));
  });
}

async function findOrderById(id) {
  return withDb(async (db, persist) => {
    const row = db.orders[id];
    return row ? hydrateOrder(row, db, persist) : null;
  });
}

async function findOneOrder(filter) {
  return withDb(async (db, persist) => {
    const rows = Object.values(db.orders);
    const row = rows.find(o => {
      if (filter._id && o.id !== filter._id) return false;
      if (filter.userId && o.userId !== filter.userId) return false;
      return true;
    });
    return row ? hydrateOrder(row, db, persist) : null;
  });
}

async function createOrder(data) {
  return withDb(async (db, persist) => {
    const id = newId();
    const ts = nowIso();
    const row = {
      id,
      userId: data.userId || null,
      name: data.name || '',
      contact: data.contact || '',
      type: data.type,
      message: data.message,
      status: 'pending',
      messages: data.messages || [],
      closedBy: null,
      closedByName: '',
      closedAt: null,
      createdAt: ts,
      updatedAt: ts,
    };
    db.orders[id] = row;
    db.orderIds.unshift(id);
    await persist();
    return hydrateOrder(row, db, persist);
  });
}

async function countOrders(filter = {}) {
  return withDb(async (db) => {
    let rows = Object.values(db.orders);
    if (filter.status) rows = rows.filter(o => o.status === filter.status);
    return rows.length;
  });
}

module.exports = {
  initStore,
  findUserById,
  findUserByEmail,
  createUser,
  findUsersByIds,
  findOrders,
  findOrderById,
  findOneOrder,
  createOrder,
  countOrders,
  User: {
    findById: findUserById,
    findOne: async (q) => findUserByEmail(q.email),
    create: createUser,
    find: async (q) => {
      if (q._id?.$in) return findUsersByIds(q._id.$in);
      return [];
    },
  },
  Order: {
    find: async (q = {}) => {
      if (q.userId) return findOrders({ userId: q.userId });
      return findOrders();
    },
    findById: findOrderById,
    findOne: async (q) => findOneOrder(q),
    create: createOrder,
    countDocuments: async (q = {}) => countOrders(q),
  },
};