const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const store = require('./lib/store');

const JWT_SECRET = process.env.JWT_SECRET || 'framecut-netlify-prod-jwt-2026-secure-key';
const ADMIN_EMAILS = (process.env.ADMIN_EMAIL || 'jlet9lra123321@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

function json(status, body) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}

function normalizePath(event) {
  let path = event.path || '';
  if (path.startsWith('/.netlify/functions/api')) {
    path = '/api' + path.slice('/.netlify/functions/api'.length);
  }
  return path.split('?')[0];
}

function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    return {};
  }
}

function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

async function authUser(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return store.findUserById(payload.userId);
  } catch {
    return null;
  }
}

function isAdmin(email) {
  return ADMIN_EMAILS.includes(email?.toLowerCase());
}

exports.handler = async (event) => {
  const path = normalizePath(event);
  const method = event.httpMethod;
  const body = parseBody(event);

  try {
    if (method === 'GET' && path === '/api/health') {
      return json(200, { ok: true, db: 'netlify-blobs' });
    }

    if (method === 'POST' && path === '/api/auth/register') {
      const { name, email, password } = body;
      if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
        return json(400, { error: 'Заполните все поля. Пароль — минимум 6 символов.' });
      }
      const normalizedEmail = email.trim().toLowerCase();
      if (await store.findUserByEmail(normalizedEmail)) {
        return json(409, { error: 'Пользователь с таким email уже существует.' });
      }
      const hash = await bcrypt.hash(password, 10);
      const user = await store.createUser({
        name: name.trim(),
        email: normalizedEmail,
        password: hash,
        role: isAdmin(normalizedEmail) ? 'admin' : 'user',
      });
      return json(201, { user: store.publicUser(user), token: signToken(user.id) });
    }

    if (method === 'POST' && path === '/api/auth/login') {
      const normalizedEmail = body.email?.trim().toLowerCase();
      const user = await store.findUserByEmail(normalizedEmail);
      if (!user || !(await bcrypt.compare(body.password || '', user.password))) {
        return json(401, { error: 'Неверный email или пароль.' });
      }
      const role = isAdmin(user.email) ? 'admin' : 'user';
      if (user.role !== role) {
        await store.updateUser(user.id, { role });
        user.role = role;
      }
      return json(200, { user: store.publicUser(user), token: signToken(user.id) });
    }

    if (method === 'GET' && path === '/api/auth/me') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      const orders = await store.listOrders({ userId: user.id });
      return json(200, { user: { ...store.publicUser(user), orders: orders.map(store.publicOrder) } });
    }

    if (method === 'PATCH' && path === '/api/users/profile') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      const patch = {};
      if (body.name !== undefined) {
        if (!body.name.trim()) return json(400, { error: 'Имя не может быть пустым' });
        patch.name = body.name.trim();
      }
      if (body.telegram !== undefined) patch.telegram = body.telegram.trim();
      if (body.avatar !== undefined) {
        if (body.avatar && body.avatar.length > 500000) {
          return json(400, { error: 'Изображение слишком большое' });
        }
        patch.avatar = body.avatar || null;
      }
      const updated = await store.updateUser(user.id, patch);
      return json(200, { user: store.publicUser(updated) });
    }

    if (method === 'GET' && path === '/api/orders') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      const orders = await store.listOrders({ userId: user.id });
      return json(200, { orders: orders.map(store.publicOrder) });
    }

    if (method === 'POST' && path === '/api/orders/guest') {
      const { name, type, message, contact } = body;
      if (!name?.trim() || !type || !message?.trim() || !contact?.trim()) {
        return json(400, { error: 'Заполните все поля заявки' });
      }
      const order = await store.createOrder({
        name: name.trim(),
        contact: contact.trim(),
        type,
        message: message.trim(),
      });
      return json(201, { order: store.publicOrder(order) });
    }

    if (method === 'POST' && path === '/api/orders') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      const { type, message, contact } = body;
      if (!type || !message?.trim()) {
        return json(400, { error: 'Укажите тип проекта и описание' });
      }
      const order = await store.createOrder({
        userId: user.id,
        name: user.name,
        contact: contact?.trim() || user.telegram || user.email,
        type,
        message: message.trim(),
      });
      return json(201, { order: store.publicOrder(order) });
    }

    const closeMatch = path.match(/^\/api\/orders\/([^/]+)\/close$/);
    if (method === 'PATCH' && closeMatch) {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      const order = await store.findOrder(closeMatch[1]);
      if (!order || order.userId !== user.id) return json(404, { error: 'Заявка не найдена' });
      if (order.status === 'done') return json(400, { error: 'Заявка уже закрыта' });
      order.status = 'done';
      order.closedBy = 'user';
      order.closedByName = user.name;
      order.closedAt = new Date().toISOString();
      await store.saveOrder(order);
      return json(200, { order: store.publicOrder(order) });
    }

    const replyMatch = path.match(/^\/api\/orders\/([^/]+)\/reply$/);
    if (method === 'POST' && replyMatch) {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      if (!body.message?.trim()) return json(400, { error: 'Введите сообщение' });
      const order = await store.findOrder(replyMatch[1]);
      if (!order || order.userId !== user.id) return json(404, { error: 'Заявка не найдена' });
      if (order.status === 'done') return json(403, { error: 'Заявка закрыта. Новые сообщения недоступны.' });
      order.messages.push({
        id: crypto.randomUUID(),
        from: 'user',
        text: body.message.trim(),
        authorName: user.name,
        createdAt: new Date().toISOString(),
      });
      await store.saveOrder(order);
      return json(200, { order: store.publicOrder(order) });
    }

    if (method === 'GET' && path === '/api/admin/orders') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      if (user.role !== 'admin') return json(403, { error: 'Доступ только для администратора' });
      const orders = await store.listOrders();
      const result = await Promise.all(orders.map(async o => {
        const u = o.userId ? await store.findUserById(o.userId) : null;
        return {
          ...store.publicOrder(o),
          name: o.name,
          userEmail: u?.email || null,
          userId: o.userId || null,
        };
      }));
      return json(200, { orders: result });
    }

    if (method === 'GET' && path === '/api/admin/stats') {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      if (user.role !== 'admin') return json(403, { error: 'Доступ только для администратора' });
      const [total, pending, inProgress, done] = await Promise.all([
        store.countOrders(),
        store.countOrders('pending'),
        store.countOrders('in_progress'),
        store.countOrders('done'),
      ]);
      return json(200, { total, pending, inProgress, done });
    }

    const adminOrderMatch = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
    if (method === 'PATCH' && adminOrderMatch) {
      const user = await authUser(event);
      if (!user) return json(401, { error: 'Требуется авторизация' });
      if (user.role !== 'admin') return json(403, { error: 'Доступ только для администратора' });
      const order = await store.findOrder(adminOrderMatch[1]);
      if (!order) return json(404, { error: 'Заявка не найдена' });
      const replyText = body.reply ?? body.adminReply;
      if (replyText !== undefined && replyText.trim()) {
        if (order.status === 'done') {
          return json(403, { error: 'Заявка закрыта. Смените статус, чтобы ответить.' });
        }
        order.messages.push({
          id: crypto.randomUUID(),
          from: 'admin',
          text: replyText.trim(),
          authorName: user.name,
          createdAt: new Date().toISOString(),
        });
      }
      if (body.status !== undefined) {
        const allowed = ['pending', 'in_progress', 'done'];
        if (!allowed.includes(body.status)) return json(400, { error: 'Неверный статус' });
        if (body.status === 'done' && order.status !== 'done') {
          order.status = 'done';
          order.closedBy = 'admin';
          order.closedByName = user.name;
          order.closedAt = new Date().toISOString();
        } else if (body.status !== 'done' && order.status === 'done') {
          order.status = body.status;
          order.closedBy = null;
          order.closedByName = '';
          order.closedAt = null;
        } else {
          order.status = body.status;
        }
      }
      await store.saveOrder(order);
      const client = order.userId ? await store.findUserById(order.userId) : null;
      return json(200, {
        order: {
          ...store.publicOrder(order),
          name: order.name,
          userEmail: client?.email || null,
          userId: order.userId || null,
        },
      });
    }

    return json(404, { error: 'Not found' });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Ошибка сервера' });
  }
};