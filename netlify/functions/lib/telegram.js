const store = require('./store');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.TELEGRAM_ADMIN_CHAT_ID
  ? String(process.env.TELEGRAM_ADMIN_CHAT_ID)
  : null;

const TYPE_LABELS = {
  youtube: 'YouTube / подкаст',
  reels: 'Reels / Shorts',
  ads: 'Реклама',
  event: 'Событие / свадьба',
  other: 'Другое',
};

async function tg(method, body) {
  if (!BOT_TOKEN) return null;
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function isConfigured() {
  return Boolean(BOT_TOKEN && ADMIN_CHAT_ID);
}

function isAdminChat(chatId) {
  return ADMIN_CHAT_ID && String(chatId) === ADMIN_CHAT_ID;
}

async function sendMessage(chatId, text, extra = {}) {
  return tg('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'HTML',
    disable_web_page_preview: true,
    ...extra,
  });
}

async function linkOrderMessage(result, orderId) {
  if (result?.ok && result.result?.message_id) {
    await store.linkTelegramMessage(result.result.message_id, orderId);
  }
}

async function notifyNewOrder(order) {
  if (!isConfigured()) return;
  const text = [
    '🆕 <b>Новая заявка</b>',
    '',
    `👤 <b>${escapeHtml(order.name || 'Гость')}</b>`,
    `✈️ ${escapeHtml(order.contact || '—')}`,
    `📁 ${escapeHtml(TYPE_LABELS[order.type] || order.type)}`,
    '',
    escapeHtml(order.message),
    '',
    `<code>${order.id}</code>`,
    '',
    '↩️ <i>Ответьте реплаем — клиент увидит ответ в личном кабинете</i>',
  ].join('\n');

  const result = await sendMessage(ADMIN_CHAT_ID, text);
  await linkOrderMessage(result, order.id);
}

async function notifyUserReply(order, messageText) {
  if (!isConfigured()) return;
  const text = [
    '💬 <b>Ответ клиента</b>',
    '',
    `👤 ${escapeHtml(order.name || 'Клиент')} · ${escapeHtml(order.contact || '')}`,
    '',
    escapeHtml(messageText),
    '',
    `<code>${order.id}</code>`,
    '',
    '↩️ <i>Ответьте реплаем на это сообщение</i>',
  ].join('\n');

  const result = await sendMessage(ADMIN_CHAT_ID, text);
  await linkOrderMessage(result, order.id);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

module.exports = {
  BOT_TOKEN,
  ADMIN_CHAT_ID,
  TYPE_LABELS,
  isConfigured,
  isAdminChat,
  sendMessage,
  notifyNewOrder,
  notifyUserReply,
};