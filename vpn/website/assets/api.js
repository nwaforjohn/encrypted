/* AuroraVPN website API client. Shared by all pages.
   Set window.AURORA_API on a page (or via <meta name="aurora-api">) to point at
   your deployed control plane; defaults to localhost for development. */
(function () {
  const meta = document.querySelector('meta[name="aurora-api"]');
  const API = (window.AURORA_API || (meta && meta.content) || 'http://localhost:8080').replace(/\/$/, '');

  const TOKEN_KEY = 'aurora_token';
  const token = {
    get: () => localStorage.getItem(TOKEN_KEY),
    set: (t) => localStorage.setItem(TOKEN_KEY, t),
    clear: () => localStorage.removeItem(TOKEN_KEY),
  };

  async function req(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (auth) {
      const t = token.get();
      if (t) headers.authorization = 'Bearer ' + t;
    }
    const res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const err = new Error((data && data.error) || ('http_' + res.status));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.Aurora = {
    API,
    token,
    isLoggedIn: () => !!token.get(),
    register: (email, password) =>
      req('/auth/register', { method: 'POST', body: { email, password } }).then((d) => { token.set(d.token); return d; }),
    login: (email, password) =>
      req('/auth/login', { method: 'POST', body: { email, password } }).then((d) => { token.set(d.token); return d; }),
    logout: () => token.clear(),
    me: () => req('/auth/me', { auth: true }),
    account: () => req('/account', { auth: true }),
    servers: () => req('/servers'),
    plans: () => req('/billing/plans'),
    checkout: (plan) => req('/billing/checkout', { method: 'POST', auth: true, body: { plan } }),
    portal: () => req('/billing/portal', { method: 'POST', auth: true }),
    status: () => req('/billing/status', { auth: true }),
    adminOverview: () => req('/admin/overview', { auth: true }),
    adminUsers: () => req('/admin/users', { auth: true }),
  };

  // ISO country code -> emoji flag.
  window.flagEmoji = function (cc) {
    if (!cc || cc.length !== 2) return '🌐';
    return cc.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
  };

  window.money = function (cents, currency) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: (currency || 'usd').toUpperCase() })
      .format((cents || 0) / 100);
  };
})();
