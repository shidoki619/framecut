const app = require('./app');

const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) {
  console.error('Ошибка: задайте JWT_SECRET в файле server/.env');
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`FrameCut запущен: http://localhost:${PORT}`);
});