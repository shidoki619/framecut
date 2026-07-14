require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Order = require('../models/Order');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = await Order.find();
  let count = 0;

  for (const order of orders) {
    const before = order.messages?.length || 0;
    order.syncMessages();
    const after = order.messages.length;
    if (after !== before) {
      await order.save();
      count++;
      console.log(`Мигрирована заявка ${order._id}: ${before} → ${after} сообщений`);
    }
  }

  console.log(`Готово. Обновлено заявок: ${count}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});