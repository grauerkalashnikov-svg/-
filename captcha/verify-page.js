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

  function getNext() {
    try {
      var params = new URLSearchParams(location.search);
      var next = params.get('next') || '/';
      if (!next.startsWith('/') || next.startsWith('//')) return '/';
      return next;
    } catch (e) {
      return '/';
    }
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

  function showError(message) {
    var el = document.getElementById('lsr-captcha-error');
    if (el) el.textContent = message || '';
  }

  function showBlocked() {
    clearSession();
    document.body.classList.add('lsr-captcha-blocked');
    var heading = document.querySelector('.lsr-captcha-heading');
    if (heading) heading.textContent = 'Access denied';
    var widget = document.getElementById('lsr-turnstile');
    if (widget) widget.style.display = 'none';
    showError(VPN_BLOCK_MSG);
  }

  function redirectNext() {
    location.replace(getNext());
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
    var hostEl = document.getElementById('lsr-captcha-host');
    if (hostEl) hostEl.textContent = location.hostname || 'legionliberty.pw';

    var widget = document.getElementById('lsr-turnstile');
    if (widget) widget.style.display = 'none';

    var heading = document.querySelector('.lsr-captcha-heading');
    if (heading) heading.textContent = 'Checking your connection…';

    checkGeo()
      .then(function (data) {
        if (data && data.blocked) {
          showBlocked();
          return;
        }
        if (data && data.ok) {
          saveSession();
          redirectNext();
          return;
        }
        showBlocked();
      })
      .catch(function () {
        if (heading) heading.textContent = 'Access denied';
        showError('Connection error. Please try again.');
      });
  }

  start();
})();
