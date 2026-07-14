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
  return store.isTelegramChatAuthorized(chatId);
}

async function authorizeBotChat(chatId) {
  await store.authorizeTelegramChat(chatId);
}

module.exports = {
  BOT_PASSWORD,
  checkBotPassword,
  isBotAuthorized,
  authorizeBotChat,
};