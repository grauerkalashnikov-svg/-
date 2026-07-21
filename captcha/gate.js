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

  function panelHtml(opts) {
    return (
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
      '</div></main>'
    );
  }

  function ensureOverlay() {
    var overlay = document.getElementById('lsr-captcha-overlay');
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.id = 'lsr-captcha-overlay';
    overlay.className = 'lsr-captcha-overlay lsr-captcha-checking';
    overlay.innerHTML = panelHtml({
      code: 'Check',
      title: 'Проверка соединения',
      lead: 'Система безопасности проверяет источник подключения. Это займёт несколько секунд.',
      reason: 'Ожидание ответа…',
    });
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function showBlocked() {
    clearSession();
    window.__lsrCaptchaOk = false;
    document.documentElement.classList.add('lsr-gate-pending');
    var overlay = ensureOverlay();
    overlay.className = 'lsr-captcha-overlay lsr-captcha-blocked';
    overlay.innerHTML = panelHtml({
      code: '403 Forbidden',
      title: 'Доступ запрещён',
      lead: 'Ваш запрос отклонен политикой безопасности. Доступ к ресурсу ограничен.',
      reason: VPN_BLOCK_MSG,
    });
  }

  function showConnError() {
    var overlay = ensureOverlay();
    overlay.className = 'lsr-captcha-overlay lsr-captcha-blocked';
    overlay.innerHTML = panelHtml({
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
        showConnError();
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
