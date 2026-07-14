function getAdminEmails() {
  const raw = process.env.ADMIN_EMAIL || '';
  return raw
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

function isAdminEmail(email) {
  return getAdminEmails().includes(email?.toLowerCase());
}

function syncUserRole(user) {
  const shouldBeAdmin = isAdminEmail(user.email);
  if (shouldBeAdmin && user.role !== 'admin') {
    user.role = 'admin';
    return true;
  }
  if (!shouldBeAdmin && user.role === 'admin' && getAdminEmails().length > 0) {
    user.role = 'user';
    return true;
  }
  return false;
}

module.exports = { getAdminEmails, isAdminEmail, syncUserRole };