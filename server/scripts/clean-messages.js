require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const Order = require('../models/Order');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  const orders = await Order.find();

  for (const order of orders) {
    order.cleanMessages();
    await order.save();
    console.log(`Очищена заявка ${order._id}: ${order.messages.length} сообщений в переписке`);
  }

  console.log(`Готово. Обработано: ${orders.length}`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});