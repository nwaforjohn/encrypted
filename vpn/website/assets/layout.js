/* Injects the shared nav + footer so every page stays in sync.
   Usage: put <div id="nav"></div> and <div id="footer"></div> and include this
   script, then call Layout.mount('home'|'pricing'|'download'|'account'). */
(function () {
  const logoSvg =
    '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5l8-3z" fill="#04122e"/></svg>';

  function nav(active) {
    const loggedIn = window.Aurora && window.Aurora.isLoggedIn();
    const link = (href, label, key) =>
      `<a href="${href}"${active === key ? ' style="color:var(--text)"' : ''}>${label}</a>`;
    return `
    <header class="nav"><div class="wrap nav-inner">
      <a class="brand" href="index.html"><span class="logo">${logoSvg}</span> AuroraVPN</a>
      <nav class="nav-links">
        ${link('index.html#features', 'Features', 'features')}
        ${link('pricing.html', 'Pricing', 'pricing')}
        ${link('download.html', 'Apps', 'download')}
        ${link('index.html#locations', 'Servers', 'locations')}
        ${
          loggedIn
            ? '<a href="account.html" class="btn btn-ghost">My Account</a>'
            : '<a href="account.html" class="btn btn-ghost">Log in</a>'
        }
        <a href="pricing.html" class="btn btn-primary">Get AuroraVPN</a>
      </nav>
    </div></header>`;
  }

  function footer() {
    return `
    <footer><div class="wrap">
      <div class="footer-grid">
        <div>
          <a class="brand" href="index.html"><span class="logo">${logoSvg}</span> AuroraVPN</a>
          <p style="max-width:320px;margin-top:14px">Fast, private, device-wide encryption powered by WireGuard. Your traffic, your rules.</p>
        </div>
        <div><h4>Product</h4><ul>
          <li><a href="pricing.html">Pricing</a></li>
          <li><a href="download.html">Download apps</a></li>
          <li><a href="index.html#features">Features</a></li>
          <li><a href="index.html#locations">Server locations</a></li>
        </ul></div>
        <div><h4>Account</h4><ul>
          <li><a href="account.html">Log in</a></li>
          <li><a href="account.html">Sign up</a></li>
          <li><a href="account.html">Manage subscription</a></li>
        </ul></div>
        <div><h4>Company</h4><ul>
          <li><a href="#">Privacy policy</a></li>
          <li><a href="#">Terms of service</a></li>
          <li><a href="#">No-logs commitment</a></li>
        </ul></div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} AuroraVPN. All rights reserved.</span>
        <span>Built with WireGuard® — a registered trademark of Jason A. Donenfeld.</span>
      </div>
    </div></footer>`;
  }

  window.Layout = {
    mount(active) {
      const n = document.getElementById('nav');
      const f = document.getElementById('footer');
      if (n) n.innerHTML = nav(active);
      if (f) f.innerHTML = footer();
    },
  };
})();
