require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: 'mongodb' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(path.join(__dirname, '..')));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

async function start() {
  if (!process.env.JWT_SECRET) {
    console.error('Ошибка: задайте JWT_SECRET в файле server/.env');
    process.exit(1);
  }

  await connectDB();

  app.listen(PORT, () => {
    console.log(`FrameCut запущен: http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('Не удалось запустить сервер:', err.message);
  process.exit(1);
});