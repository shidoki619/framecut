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

module.exports = { getThreadMessages };