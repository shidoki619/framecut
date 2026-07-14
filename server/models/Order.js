const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    from: { type: String, enum: ['user', 'admin'], required: true },
    text: { type: String, required: true },
    authorName: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const orderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, default: '' },
    contact: { type: String, default: '' },
    type: {
      type: String,
      enum: ['youtube', 'reels', 'ads', 'event', 'other'],
      required: true,
    },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'done'],
      default: 'pending',
    },
    messages: [messageSchema],
    closedBy: { type: String, enum: ['user', 'admin', null], default: null },
    closedByName: { type: String, default: '' },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

function getThreadMessages(doc) {
  const userMsgs = [];
  const adminByText = new Map();

  for (const m of doc.messages || []) {
    if (m.from === 'user' && m.text === doc.message) continue;

    const entry = {
      from: m.from,
      text: m.text,
      authorName: m.authorName || (m.from === 'admin' ? 'Админ' : 'Клиент'),
      createdAt: m.createdAt,
    };

    if (m.from === 'admin') {
      const existing = adminByText.get(m.text);
      if (!existing || (existing.authorName === 'Админ' && entry.authorName !== 'Админ')) {
        adminByText.set(m.text, entry);
      }
      continue;
    }

    userMsgs.push(entry);
  }

  return [...userMsgs, ...adminByText.values()].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );
}

function closedInfo(doc) {
  if (doc.status !== 'done') return {};
  return {
    closedBy: doc.closedBy || null,
    closedByName: doc.closedByName || '',
    closedAt: doc.closedAt || null,
  };
}

function orderBase(doc) {
  return {
    id: doc._id.toString(),
    type: doc.type,
    message: doc.message,
    contact: doc.contact,
    status: doc.status,
    closed: doc.status === 'done',
    messages: getThreadMessages(doc),
    createdAt: doc.createdAt,
    ...closedInfo(doc),
  };
}

orderSchema.methods.toPublic = function toPublic() {
  return orderBase(this);
};

orderSchema.methods.toAdmin = function toAdmin(user) {
  return {
    ...orderBase(this),
    name: this.name,
    userEmail: user?.email || null,
    userId: this.userId?.toString() || null,
  };
};

orderSchema.methods.close = function close(by, name) {
  this.status = 'done';
  this.closedBy = by;
  this.closedByName = name || '';
  this.closedAt = new Date();
};

orderSchema.methods.clearClose = function clearClose() {
  this.closedBy = null;
  this.closedByName = '';
  this.closedAt = null;
};

orderSchema.methods.addMessage = function addMessage({ from, text, authorName }) {
  if (!this.messages) this.messages = [];
  this.messages.push({ from, text, authorName, createdAt: new Date() });
};

orderSchema.methods.cleanMessages = function cleanMessages() {
  const cleaned = [];
  const adminTexts = new Set();

  for (const m of this.messages || []) {
    if (m.from === 'user' && m.text === this.message) continue;

    if (m.from === 'admin') {
      if (adminTexts.has(m.text)) continue;
      adminTexts.add(m.text);
    }

    cleaned.push({
      from: m.from,
      text: m.text,
      authorName: m.authorName || '',
      createdAt: m.createdAt || new Date(),
    });
  }

  this.messages = cleaned;
};

module.exports = mongoose.model('Order', orderSchema);
module.exports.getThreadMessages = getThreadMessages;