(function () {
  var cfg = window.LSR_CAPTCHA || {};
  var STORAGE_KEY = 'lsr_captcha_ok';
  var STORAGE_UNTIL = 'lsr_captcha_until';
  var ttlMs = (cfg.ttlHours || 24) * 60 * 60 * 1000;

  function now() {
    return Date.now();
  }

  function hasValidSession() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === '1' && Number(sessionStorage.getItem(STORAGE_UNTIL) || 0) > now();
    } catch (e) {
      return false;
    }
  }

  function saveSession() {
    try {
      sessionStorage.setItem(STORAGE_KEY, '1');
      sessionStorage.setItem(STORAGE_UNTIL, String(now() + ttlMs));
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

  function loadTurnstile(callback) {
    if (window.turnstile) {
      callback();
      return;
    }
    var script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = callback;
    script.onerror = function () {
      showError('Could not load verification. Please refresh the page.');
    };
    document.head.appendChild(script);
  }

  function verifyToken(token) {
    return fetch(cfg.verifyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token }),
      credentials: 'omit',
    }).then(function (res) {
      return res.json();
    });
  }

  function renderChallenge() {
    var host = location.hostname || 'legionliberty.pw';
    var overlay = document.createElement('div');
    overlay.id = 'lsr-captcha-overlay';
    overlay.className = 'lsr-captcha-overlay';
    overlay.innerHTML =
      '<main class="lsr-captcha-page-main">' +
      '<h1 class="lsr-captcha-heading">Verifying you are human. This may take a few seconds.</h1>' +
      '<div id="lsr-turnstile" class="lsr-captcha-widget"></div>' +
      '<p id="lsr-captcha-error" class="lsr-captcha-error" role="alert"></p>' +
      '<p class="lsr-captcha-footer"><span>' + host + '</span> needs to review the security of your connection before proceeding.</p>' +
      '</main>';
    document.documentElement.appendChild(overlay);

    loadTurnstile(function () {
      if (!window.turnstile) {
        showError('Verification service unavailable.');
        return;
      }

      window.turnstile.render('#lsr-turnstile', {
        sitekey: cfg.siteKey,
        theme: 'light',
        size: 'normal',
        callback: function (token) {
          showError('');
          verifyToken(token)
            .then(function (data) {
              if (data && data.ok) {
                saveSession();
                unlock();
                return;
              }
              showError((data && data.error) || 'Verification failed. Please try again.');
              window.turnstile.reset('#lsr-turnstile');
            })
            .catch(function () {
              showError('Connection error. Please try again.');
              window.turnstile.reset('#lsr-turnstile');
            });
        },
        'error-callback': function () {
          showError('Verification error. Please refresh the page.');
        },
        'expired-callback': function () {
          showError('Verification expired. Please try again.');
        },
      });
    });
  }

  if (hasValidSession()) {
    unlock();
    return;
  }

  document.documentElement.classList.add('lsr-gate-pending');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderChallenge);
  } else {
    renderChallenge();
  }
})();
