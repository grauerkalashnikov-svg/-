(function () {
  var cfg = window.LSR_CAPTCHA || {};
  var STORAGE_KEY = 'lsr_captcha_ok';
  var STORAGE_UNTIL = 'lsr_captcha_until';
  var ttlMs = (cfg.ttlHours || 24) * 60 * 60 * 1000;

  function now() {
    return Date.now();
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

  function showError(message) {
    var el = document.getElementById('lsr-captcha-error');
    if (el) el.textContent = message || '';
  }

  function redirectNext() {
    location.replace(getNext());
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

  function renderTurnstile() {
    if (!window.turnstile) {
      showError('Не удалось загрузить проверку Cloudflare. Обновите страницу.');
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
              redirectNext();
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
  }

  var hostEl = document.getElementById('lsr-captcha-host');
  if (hostEl) hostEl.textContent = location.hostname || 'legionliberty.pw';

  if (hasValidSession()) {
    redirectNext();
    return;
  }

  if (window.turnstile) {
    renderTurnstile();
  } else {
    window.addEventListener('load', renderTurnstile);
  }
})();
