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
      showError('Не удалось загрузить проверку. Обновите страницу.');
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

  function renderOverlay() {
    var overlay = document.createElement('div');
    overlay.id = 'lsr-captcha-overlay';
    overlay.className = 'lsr-captcha-overlay';
    overlay.innerHTML =
      '<div class="lsr-captcha-card">' +
      '<p class="lsr-captcha-logo">Легион «Свобода России»</p>' +
      '<h1 class="lsr-captcha-title">Проверка доступа</h1>' +
      '<p class="lsr-captcha-text">Подтвердите, что вы человек, чтобы продолжить на сайт.</p>' +
      '<input class="lsr-captcha-hp" type="text" name="lsr_hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
      '<div id="lsr-turnstile" class="lsr-captcha-widget"></div>' +
      '<div id="lsr-captcha-error" class="lsr-captcha-error"></div>' +
      '</div>';
    document.documentElement.appendChild(overlay);

    loadTurnstile(function () {
      if (!window.turnstile) {
        showError('Сервис проверки недоступен.');
        return;
      }

      window.turnstile.render('#lsr-turnstile', {
        sitekey: cfg.siteKey,
        theme: 'dark',
        callback: function (token) {
          var honeypot = document.querySelector('.lsr-captcha-hp');
          if (honeypot && honeypot.value) return;

          showError('');
          verifyToken(token)
            .then(function (data) {
              if (data && data.ok) {
                saveSession();
                unlock();
                return;
              }
              showError((data && data.error) || 'Проверка не пройдена. Попробуйте снова.');
              window.turnstile.reset('#lsr-turnstile');
            })
            .catch(function () {
              showError('Ошибка связи с сервером. Попробуйте позже.');
              window.turnstile.reset('#lsr-turnstile');
            });
        },
        'error-callback': function () {
          showError('Ошибка капчи. Обновите страницу.');
        },
        'expired-callback': function () {
          showError('Время проверки истекло. Пройдите капчу снова.');
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
    document.addEventListener('DOMContentLoaded', renderOverlay);
  } else {
    renderOverlay();
  }
})();
