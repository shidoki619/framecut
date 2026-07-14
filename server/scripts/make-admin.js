/**
 * Назначить существующего пользователя администратором:
 * node scripts/make-admin.js user@email.com
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const User = require('../models/User');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    console.error('Укажите email: node scripts/make-admin.js user@email.com');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOneAndUpdate(
    { email },
    { role: 'admin' },
    { new: true }
  );

  if (!user) {
    console.error(`Пользователь ${email} не найден. Сначала зарегистрируйтесь на сайте.`);
    process.exit(1);
  }

  console.log(`Готово: ${user.name} (${user.email}) теперь администратор`);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err.message);
  process.exit(1);
});