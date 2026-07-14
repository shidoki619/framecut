const express = require('express');
const Order = require('../models/Order');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id });
    res.json({ orders: orders.map(o => o.toPublic()) });
  } catch (err) {
    console.error('Orders list error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, message, contact } = req.body;

    if (!type || !message?.trim()) {
      return res.status(400).json({ error: 'Укажите тип проекта и описание' });
    }

    const text = message.trim();
    const order = await Order.create({
      userId: req.user._id,
      name: req.user.name,
      contact: contact?.trim() || req.user.telegram || req.user.email,
      type,
      message: text,
      messages: [],
    });

    res.status(201).json({ order: order.toPublic() });
  } catch (err) {
    console.error('Order create error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/guest', async (req, res) => {
  try {
    const { name, type, message, contact } = req.body;

    if (!name?.trim() || !type || !message?.trim() || !contact?.trim()) {
      return res.status(400).json({ error: 'Заполните все поля заявки' });
    }

    const text = message.trim();
    const order = await Order.create({
      name: name.trim(),
      contact: contact.trim(),
      type,
      message: text,
      messages: [],
    });

    res.status(201).json({ order: order.toPublic() });
  } catch (err) {
    console.error('Guest order error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/:id/close', requireAuth, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    if (order.status === 'done') {
      return res.status(400).json({ error: 'Заявка уже закрыта' });
    }

    order.close('user', req.user.name);
    await order.save();
    res.json({ order: order.toPublic() });
  } catch (err) {
    console.error('Order close error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.post('/:id/reply', requireAuth, async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: 'Введите сообщение' });
    }

    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    if (order.status === 'done') {
      return res.status(403).json({ error: 'Заявка закрыта. Новые сообщения недоступны.' });
    }

    order.addMessage({
      from: 'user',
      text: message.trim(),
      authorName: req.user.name,
    });

    await order.save();
    res.json({ order: order.toPublic() });
  } catch (err) {
    console.error('Order reply error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;