require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');
const { initStore } = require('./db/store');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const adminRoutes = require('./routes/admin');

const app = express();
const ready = initStore();

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : null;

app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (!corsOrigins) return callback(null, true);
    if (corsOrigins.includes(origin) || /\.netlify\.app$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('CORS blocked'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '1mb' }));

app.use(async (_req, _res, next) => {
  try {
    await ready;
    next();
  } catch (err) {
    next(err);
  }
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, db: process.env.NETLIFY ? 'netlify-blobs' : 'local' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

if (!process.env.NETLIFY) {
  app.use(express.static(path.join(__dirname, '..')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Внутренняя ошибка сервера' });
});

module.exports = app;