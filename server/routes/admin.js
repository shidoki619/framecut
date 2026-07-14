const express = require('express');
const Order = require('../models/Order');
const User = require('../models/User');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/orders', async (_req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    const userIds = [...new Set(orders.filter(o => o.userId).map(o => o.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } });
    const userMap = Object.fromEntries(users.map(u => [u._id.toString(), u]));

    res.json({
      orders: orders.map(o => o.toAdmin(userMap[o.userId?.toString()])),
    });
  } catch (err) {
    console.error('Admin orders error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.patch('/orders/:id', async (req, res) => {
  try {
    const { status, adminReply } = req.body;
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Заявка не найдена' });
    }

    const replyText = req.body.reply ?? adminReply;
    if (replyText !== undefined && replyText.trim()) {
      if (order.status === 'done') {
        return res.status(403).json({ error: 'Заявка закрыта. Смените статус, чтобы ответить.' });
      }
      order.addMessage({
        from: 'admin',
        text: replyText.trim(),
        authorName: req.user.name,
      });
    }

    if (status !== undefined) {
      const allowed = ['pending', 'in_progress', 'done'];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: 'Неверный статус' });
      }
      if (status === 'done' && order.status !== 'done') {
        order.close('admin', req.user.name);
      } else if (status !== 'done' && order.status === 'done') {
        order.clearClose();
        order.status = status;
      } else {
        order.status = status;
      }
    }

    await order.save();

    let user = null;
    if (order.userId) {
      user = await User.findById(order.userId);
    }

    res.json({ order: order.toAdmin(user) });
  } catch (err) {
    console.error('Admin update order error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

router.get('/stats', async (_req, res) => {
  try {
    const [total, pending, inProgress, done] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: 'in_progress' }),
      Order.countDocuments({ status: 'done' }),
    ]);

    res.json({ total, pending, inProgress, done });
  } catch (err) {
    console.error('Admin stats error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;