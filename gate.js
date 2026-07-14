(() => {
  if (typeof Auth === 'undefined') return;
  const page = (location.pathname.split('/').pop() || 'index.html').split('?')[0];
  if (page === 'access.html') return;
  if (!Auth.hasSiteAccess()) {
    const next = encodeURIComponent(
      `${location.pathname.split('/').pop() || 'index.html'}${location.search}${location.hash}`
    );
    location.replace(`access.html?next=${next}`);
  }
})();