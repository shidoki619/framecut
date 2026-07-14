/**
 * Usage:
 *   TELEGRAM_BOT_TOKEN=xxx SITE_URL=https://musical-rabanadas-93aa47.netlify.app node scripts/setup-telegram-webhook.js
 */
const token = process.env.TELEGRAM_BOT_TOKEN;
const siteUrl = (process.env.SITE_URL || 'https://musical-rabanadas-93aa47.netlify.app').replace(/\/$/, '');

if (!token) {
  console.error('Set TELEGRAM_BOT_TOKEN env variable');
  process.exit(1);
}

const webhookUrl = `${siteUrl}/.netlify/functions/telegram-webhook`;

async function main() {
  const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
  });
  const data = await res.json();
  console.log(data.ok ? `Webhook set: ${webhookUrl}` : data);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});