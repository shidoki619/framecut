const crypto = require('crypto');
const store = require('./lib/store');
const telegram = require('./lib/telegram');
const orderAdmin = require('./lib/order-admin');

function ok() {
  return { statusCode: 200, body: 'ok' };
}

async function addAdminReply(order, text) {
  order.messages.push({
    id: crypto.randomUUID(),
    from: 'admin',
    text: text.trim(),
    authorName: 'Egor',
    createdAt: new Date().toISOString(),
  });
  await store.saveOrder(order);
}

async function answerCallback(cb, text) {
  await telegram.tg('answerCallbackQuery', {
    callback_query_id: cb.id,
    text,
    show_alert: false,
  });
}

async function handleStatusChange(chatId, order, status) {
  await orderAdmin.setOrderStatus(order, status);
  const label = orderAdmin.STATUS_LABELS[status];
  await telegram.sendMessage(chatId, `✅ Заявка <code>${order.id}</code>\nСтатус: <b>${label}</b>`);
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return ok();

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch {
    return ok();
  }

  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message?.chat?.id;
    if (!telegram.isConfigured() || !telegram.isAdminChat(chatId)) {
      await answerCallback(cb, 'Нет доступа');
      return ok();
    }

    const [action, orderId] = (cb.data || '').split(':');
    const order = await store.findOrder(orderId);
    if (!order) {
      await answerCallback(cb, 'Заявка не найдена');
      return ok();
    }

    if (action === 'work') {
      await handleStatusChange(chatId, order, 'in_progress');
      await answerCallback(cb, 'В работе');
    } else if (action === 'close') {
      await handleStatusChange(chatId, order, 'done');
      await answerCallback(cb, 'Закрыта');
    } else if (action === 'open') {
      await handleStatusChange(chatId, order, 'in_progress');
      await answerCallback(cb, 'Открыта');
    } else {
      await answerCallback(cb, 'Неизвестная команда');
    }
    return ok();
  }

  const msg = update.message;
  if (!msg?.text) return ok();

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  if (!telegram.isConfigured()) {
    if (text === '/start') {
      await telegram.sendMessage(chatId, 'Бот не настроен. Добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_ADMIN_CHAT_ID в Netlify.');
    }
    return ok();
  }

  if (!telegram.isAdminChat(chatId)) {
    await telegram.sendMessage(chatId, 'Этот бот только для администратора сайта.');
    return ok();
  }

  const [command, ...args] = text.split(/\s+/);
  const arg = args.join(' ').trim();

  if (command === '/start' || command === '/help') {
    await telegram.sendMessage(
      chatId,
      [
        '<b>FrameCut бот</b>',
        '',
        '<b>Заявки</b>',
        '/orders — открытые заявки',
        '/order ID — детали заявки',
        '',
        '<b>Статусы</b>',
        '/work ID — взять в работу',
        '/close ID — закрыть заявку',
        '/open ID — открыть снова',
        '',
        '<b>Ответ клиенту</b>',
        'Реплай на уведомление о заявке',
        '',
        'ID можно копировать целиком или первые 8 символов.',
      ].join('\n')
    );
    return ok();
  }

  if (command === '/orders') {
    const orders = (await store.listOrders()).filter(o => o.status !== 'done').slice(0, 10);
    if (!orders.length) {
      await telegram.sendMessage(chatId, 'Открытых заявок нет.');
      return ok();
    }
    const lines = orders.map((o, i) => orderAdmin.formatOrderBrief(o, i + 1));
    await telegram.sendMessage(chatId, `<b>Открытые заявки</b>\n\n${lines.join('\n\n')}`);
    return ok();
  }

  if (command === '/order') {
    const order = await orderAdmin.findOrderByRef(arg);
    if (!order) {
      await telegram.sendMessage(chatId, 'Заявка не найдена. Укажите ID: /order abc12345');
      return ok();
    }
    const status = orderAdmin.STATUS_LABELS[order.status];
    const type = telegram.TYPE_LABELS[order.type] || order.type;
    await telegram.sendMessage(
      chatId,
      [
        `<b>${order.name || 'Гость'}</b>`,
        `✈️ ${order.contact || '—'}`,
        `📁 ${type}`,
        `📌 ${status}`,
        '',
        order.message,
        '',
        `<code>${order.id}</code>`,
      ].join('\n')
    );
    return ok();
  }

  if (command === '/work') {
    const order = await orderAdmin.findOrderByRef(arg);
    if (!order) {
      await telegram.sendMessage(chatId, 'Заявка не найдена: /work ID');
      return ok();
    }
    await handleStatusChange(chatId, order, 'in_progress');
    return ok();
  }

  if (command === '/close') {
    const order = await orderAdmin.findOrderByRef(arg);
    if (!order) {
      await telegram.sendMessage(chatId, 'Заявка не найдена: /close ID');
      return ok();
    }
    await handleStatusChange(chatId, order, 'done');
    return ok();
  }

  if (command === '/open') {
    const order = await orderAdmin.findOrderByRef(arg);
    if (!order) {
      await telegram.sendMessage(chatId, 'Заявка не найдена: /open ID');
      return ok();
    }
    await handleStatusChange(chatId, order, 'in_progress');
    return ok();
  }

  if (msg.reply_to_message) {
    const orderId = await store.getOrderIdByTelegramMessage(msg.reply_to_message.message_id);
    if (!orderId) {
      await telegram.sendMessage(chatId, 'Не нашёл заявку. Ответьте реплаем на уведомление о заявке.');
      return ok();
    }

    const order = await store.findOrder(orderId);
    if (!order) {
      await telegram.sendMessage(chatId, 'Заявка не найдена.');
      return ok();
    }

    if (order.status === 'done') {
      await telegram.sendMessage(chatId, 'Заявка закрыта. /open ID чтобы открыть снова.');
      return ok();
    }

    await addAdminReply(order, text);

    if (order.userId) {
      await telegram.sendMessage(chatId, `✅ Ответ отправлен клиенту на сайте\n<code>${order.id}</code>`);
    } else {
      await telegram.sendMessage(
        chatId,
        `✅ Ответ сохранён. Гость без аккаунта — напишите в Telegram:\n<b>${order.contact}</b>`
      );
    }
    return ok();
  }

  return ok();
};