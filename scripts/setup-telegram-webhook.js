/**
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=yyy SITE_URL=https://... node scripts/setup-telegram-webhook.js
 */
const crypto = require('crypto');

const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = (process.env.SITE_URL || 'https://musical-rabanadas-93aa47.netlify.app').replace(/\/$/, '');
const secret = process.env.TELEGRAM_WEBHOOK_SECRET || crypto.randomBytes(24).toString('hex');

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN env variable');
  process.exit(1);
}

const webhookUrl = `${siteUrl}/.netlify/functions/telegram-webhook`;

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      drop_pending_updates: true,
    }),
  });
  const data = await res.json();
  if (data.ok) {
    console.log(`Webhook set: ${webhookUrl}`);
    console.log(`TELEGRAM_WEBHOOK_SECRET=${secret}`);
    console.log('Add this secret to Netlify environment variables.');
  } else {
    console.log(data);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});