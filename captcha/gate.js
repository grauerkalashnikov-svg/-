(function () {
  var cfg = window.LSR_CAPTCHA || {};
  var STORAGE_KEY = 'lsr_captcha_ok';
  var STORAGE_UNTIL = 'lsr_captcha_until';
  var VPN_BLOCK_MSG = 'VPN blocked. Подозрение на бота.';
  var ttlMs = (cfg.ttlHours || 24) * 60 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function geoCheckUrl() {
    if (cfg.geoCheckUrl) return cfg.geoCheckUrl;
    if (cfg.verifyUrl) return String(cfg.verifyUrl).replace(/\/api\/captcha\/verify\/?$/, '/api/geo/check');
    return '';
  }

  function saveSession() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
      sessionStorage.setItem(STORAGE_UNTIL, String(now() + ttlMs));
    } catch (e) {}
  }

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_UNTIL);
    } catch (e) {}
  }

  function unlock() {
    document.documentElement.classList.remove('lsr-gate-pending');
    window.__lsrCaptchaOk = true;
    window.dispatchEvent(new Event('lsr-captcha-ok'));
    var overlay = document.getElementById('lsr-captcha-overlay');
    if (overlay) overlay.remove();
  }

  function showError(message) {
    var el = document.getElementById('lsr-captcha-error');
    if (el) el.textContent = message || '';
  }

  function ensureOverlay() {
    var overlay = document.getElementById('lsr-captcha-overlay');
    if (overlay) return overlay;
    var host = location.hostname || 'legionliberty.pw';
    overlay = document.createElement('div');
    overlay.id = 'lsr-captcha-overlay';
    overlay.className = 'lsr-captcha-overlay';
    overlay.innerHTML =
      '<main class="lsr-captcha-page-main">' +
      '<h1 class="lsr-captcha-heading">Checking your connection…</h1>' +
      '<div id="lsr-turnstile" class="lsr-captcha-widget" style="display:none"></div>' +
      '<p id="lsr-captcha-error" class="lsr-captcha-error" role="alert"></p>' +
      '<p class="lsr-captcha-footer"><span>' + host + '</span> needs to review the security of your connection before proceeding.</p>' +
      '</main>';
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function showBlocked() {
    clearSession();
    window.__lsrCaptchaOk = false;
    document.documentElement.classList.add('lsr-gate-pending');
    var overlay = ensureOverlay();
    overlay.classList.add('lsr-captcha-blocked');
    var heading = overlay.querySelector('.lsr-captcha-heading');
    if (heading) heading.textContent = 'Access denied';
    showError(VPN_BLOCK_MSG);
  }

  function checkGeo() {
    var url = geoCheckUrl();
    if (!url) return Promise.resolve({ ok: true, blocked: false });
    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    }).then(function (res) {
      return res.json().then(function (data) {
        return data || {};
      });
    });
  }

  function start() {
    document.documentElement.classList.add('lsr-gate-pending');
    ensureOverlay();
    checkGeo()
      .then(function (data) {
        if (data && data.blocked) {
          showBlocked();
          return;
        }
        if (data && data.ok) {
          saveSession();
          unlock();
          return;
        }
        showBlocked();
      })
      .catch(function () {
        var overlay = ensureOverlay();
        var heading = overlay.querySelector('.lsr-captcha-heading');
        if (heading) heading.textContent = 'Access denied';
        showError('Connection error. Please try again.');
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
