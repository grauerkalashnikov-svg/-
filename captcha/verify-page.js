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

  function hostName() {
    return location.hostname || 'legionliberty.pw';
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

  function redirectNext() {
    location.replace(getNext());
  }

  function renderPanel(opts) {
    document.body.className = 'lsr-captcha-page ' + (opts.state || '');
    document.body.innerHTML =
      '<main class="lsr-captcha-page-main">' +
      '<div class="lsr-captcha-panel-bar" aria-hidden="true"></div>' +
      '<div class="lsr-captcha-panel-body">' +
      '<div class="lsr-captcha-code">' + (opts.code || 'SEC') + '</div>' +
      '<h1 class="lsr-captcha-heading">' + (opts.title || '') + '</h1>' +
      '<p class="lsr-captcha-lead">' + (opts.lead || '') + '</p>' +
      '<div class="lsr-captcha-reason">' +
      '<span class="lsr-captcha-reason-label">Причина отказа</span>' +
      '<p id="lsr-captcha-error" class="lsr-captcha-error" role="alert">' + (opts.reason || '') + '</p>' +
      '</div>' +
      '<p class="lsr-captcha-meta">Хост: <strong>' + hostName() + '</strong><br>Запрос заблокирован системой безопасности.</p>' +
      '</div></main>';
  }

  function showBlocked() {
    clearSession();
    document.title = '403 — Access Denied';
    renderPanel({
      state: 'lsr-captcha-blocked',
      code: '403 Forbidden',
      title: 'Доступ запрещён',
      lead: 'Ваш запрос отклонен политикой безопасности. Доступ к ресурсу ограничен.',
      reason: VPN_BLOCK_MSG,
    });
  }

  function showConnError() {
    document.title = '503 — Unavailable';
    renderPanel({
      state: 'lsr-captcha-blocked',
      code: '503 Unavailable',
      title: 'Сервис временно недоступен',
      lead: 'Не удалось выполнить проверку безопасности. Повторите попытку позже.',
      reason: 'Connection error. Please try again.',
    });
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
    document.title = 'Security Check';
    renderPanel({
      state: 'lsr-captcha-checking',
      code: 'Check',
      title: 'Проверка соединения',
      lead: 'Система безопасности проверяет источник подключения. Это займёт несколько секунд.',
      reason: 'Ожидание ответа…',
    });

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
        showConnError();
      });
  }

  start();
})();
