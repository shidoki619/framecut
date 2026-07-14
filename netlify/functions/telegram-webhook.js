const crypto = require('crypto');
const store = require('./lib/store');
const telegram = require('./lib/telegram');

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return ok();

  let update;
  try {
    update = JSON.parse(event.body || '{}');
  } catch {
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

  if (text === '/start') {
    await telegram.sendMessage(
      chatId,
      [
        '<b>FrameCut бот</b>',
        '',
        `Ваш chat ID: <code>${chatId}</code>`,
        '',
        '• Новые заявки приходят сюда автоматически',
        '• Ответьте <b>реплаем</b> на уведомление — клиент увидит ответ на сайте',
        '• /orders — открытые заявки',
      ].join('\n')
    );
    return ok();
  }

  if (text === '/orders' || text.startsWith('/orders ')) {
    const orders = (await store.listOrders()).filter(o => o.status !== 'done').slice(0, 10);
    if (!orders.length) {
      await telegram.sendMessage(chatId, 'Открытых заявок нет.');
      return ok();
    }
    const lines = orders.map((o, i) => {
      const label = telegram.TYPE_LABELS[o.type] || o.type;
      return `${i + 1}. <b>${o.name || 'Гость'}</b> · ${label}\n<code>${o.id}</code>`;
    });
    await telegram.sendMessage(chatId, `<b>Открытые заявки</b>\n\n${lines.join('\n\n')}`);
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
      await telegram.sendMessage(chatId, 'Заявка закрыта. Смените статус в админке, чтобы ответить.');
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