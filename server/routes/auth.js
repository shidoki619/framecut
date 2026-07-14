const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Order = require('../models/Order');
const { signToken, requireAuth } = require('../middleware/auth');
const { isAdminEmail, syncUserRole } = require('../utils/admin');

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password || password.length < 6) {
      return res.status(400).json({ error: 'Заполните все поля. Пароль — минимум 6 символов.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const exists = await User.findOne({ email: normalizedEmail });
    if (exists) {
      return res.status(409).json({ error: 'Пользователь с таким email уже существует.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hash,
      role: isAdminEmail(normalizedEmail) ? 'admin' : 'user',
    });

    const token = signToken(user._id);
    res.status(201).json({ user: user.toPublic(), token });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ error: 'Неверный email или пароль.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Неверный email или пароль.' });
    }

    if (syncUserRole(user)) {
      await user.save();
    }

    const token = signToken(user._id);
    res.json({ user: user.toPublic(), token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 });
    res.json({
      user: {
        ...req.user.toPublic(),
        orders: orders.map(o => o.toPublic()),
      },
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;