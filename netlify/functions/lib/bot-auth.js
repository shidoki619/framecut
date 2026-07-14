const crypto = require('crypto');
const store = require('./store');

const BOT_PASSWORD = process.env.TELEGRAM_BOT_PASSWORD || '';

function checkBotPassword(password) {
  if (!BOT_PASSWORD) return false;
  const input = String(password || '');
  const expected = BOT_PASSWORD;
  if (input.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(input), Buffer.from(expected));
}

async function isBotAuthorized(chatId) {
  if (!BOT_PASSWORD) return true;
  const db = await store.readDb();
  return Boolean(db.telegramAuth?.[String(chatId)]);
}

async function authorizeBotChat(chatId) {
  const db = await store.readDb();
  if (!db.telegramAuth) db.telegramAuth = {};
  db.telegramAuth[String(chatId)] = new Date().toISOString();
  await store.writeDb(db);
}

module.exports = {
  BOT_PASSWORD,
  checkBotPassword,
  isBotAuthorized,
  authorizeBotChat,
};