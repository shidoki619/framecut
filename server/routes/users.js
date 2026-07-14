const express = require('express');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { name, telegram, avatar } = req.body;
    const user = req.user;

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({ error: 'Имя не может быть пустым' });
      }
      user.name = name.trim();
    }

    if (telegram !== undefined) {
      user.telegram = telegram.trim();
    }

    if (avatar !== undefined) {
      if (avatar && avatar.length > 500000) {
        return res.status(400).json({ error: 'Изображение слишком большое' });
      }
      user.avatar = avatar || null;
    }

    await user.save();
    res.json({ user: user.toPublic() });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

module.exports = router;