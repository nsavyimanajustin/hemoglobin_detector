/**
 * Shared sidebar / hamburger-menu behaviour.
 * Works on all pages. Include at the bottom of <body>.
 *
 * Desktop : hover the toggle button (or the open sidebar) to reveal/hide.
 * Mobile  : tap the toggle button to open; tap overlay or a link to close.
 */
(function () {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('menuToggle');
  const overlay = document.getElementById('sidebarOverlay');

  if (!sidebar || !toggle) return;

  let closeTimer = null;

  function isTouch() {
    return window.matchMedia('(hover: none), (pointer: coarse)').matches;
  }

  function open() {
    clearTimeout(closeTimer);
    sidebar.classList.add('open');
    toggle.classList.add('active');
    if (overlay) overlay.classList.add('active');
    document.body.classList.add('sidebar-is-open');
  }

  function close(delay) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(function () {
      sidebar.classList.remove('open');
      toggle.classList.remove('active');
      if (overlay) overlay.classList.remove('active');
      document.body.classList.remove('sidebar-is-open');
    }, delay || 0);
  }

  // ── Desktop: hover ───────────────────────────────────────────────────────
  toggle.addEventListener('mouseenter', function () {
    if (!isTouch()) open();
  });
  toggle.addEventListener('mouseleave', function () {
    if (!isTouch()) close(280);
  });
  sidebar.addEventListener('mouseenter', function () {
    if (!isTouch()) { clearTimeout(closeTimer); open(); }
  });
  sidebar.addEventListener('mouseleave', function () {
    if (!isTouch()) close(180);
  });

  // ── Mobile: tap toggle ───────────────────────────────────────────────────
  toggle.addEventListener('click', function () {
    if (sidebar.classList.contains('open')) {
      close();
    } else {
      open();
    }
  });

  // ── Close on overlay tap (mobile backdrop) ───────────────────────────────
  if (overlay) {
    overlay.addEventListener('click', function () { close(); });
  }

  // ── Close when a nav link is clicked ────────────────────────────────────
  sidebar.querySelectorAll('.sidebar-link').forEach(function (link) {
    link.addEventListener('click', function () { close(80); });
  });
})();
