(function () {
  var cfg = window.LSR_CAPTCHA || {};
  var STORAGE_KEY = 'lsr_geo_ok';
  var STORAGE_UNTIL = 'lsr_geo_until';
  var VPN_BLOCK_MSG = 'VPN blocked. Подозрение на бота.';
  var ALLOWED = { RU: 1, BY: 1, UA: 1 };
  var ttlMs = (cfg.ttlHours || 24) * 60 * 60 * 1000;
  var CHECK_MS = 5000;

  function now() {
    return Date.now();
  }

  function hostName() {
    return location.hostname || 'legionliberty.pw';
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

  function clearSession() {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_UNTIL);
      sessionStorage.removeItem('lsr_captcha_ok');
      sessionStorage.removeItem('lsr_captcha_until');
    } catch (e) {}
  }

  function rayId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function render(kind) {
    var host = hostName();
    document.body.className = 'lsr-captcha-page ' + (kind === 'blocked' ? 'lsr-captcha-blocked' : 'lsr-captcha-checking');
    if (kind === 'blocked') {
      document.title = 'Attention Required | ' + host;
      document.body.innerHTML =
        '<main class="lsr-captcha-page-main">' +
        '<p class="lsr-captcha-brand">Security Check</p>' +
        '<h1 class="lsr-captcha-heading">Sorry, you have been blocked</h1>' +
        '<p class="lsr-captcha-lead">You are unable to access <strong>' + host + '</strong>.</p>' +
        '<p class="lsr-captcha-error" role="alert">' + VPN_BLOCK_MSG + '</p>' +
        '<p class="lsr-captcha-footer">This website uses a security service to protect against malicious bots and VPN abuse.</p>' +
        '<p class="lsr-captcha-ray">Ray ID: ' + rayId() + '</p>' +
        '</main>';
      return;
    }
    document.title = 'Just a moment...';
    document.body.innerHTML =
      '<main class="lsr-captcha-page-main">' +
      '<p class="lsr-captcha-brand">Security Check</p>' +
      '<h1 class="lsr-captcha-heading">Checking if the site connection is secure</h1>' +
      '<div class="lsr-spinner" aria-hidden="true"></div>' +
      '<p class="lsr-captcha-lead">Please wait a moment while we verify your connection.</p>' +
      '<p class="lsr-captcha-footer"><strong>' + host + '</strong> needs to review the security of your connection before proceeding.</p>' +
      '</main>';
  }

  function fetchJson(url, ms) {
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () {
      if (ctrl) ctrl.abort();
    }, ms || 4000);

    return fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
      signal: ctrl ? ctrl.signal : undefined,
    })
      .then(function (res) {
        return res.json();
      })
      .finally(function () {
        clearTimeout(timer);
      });
  }

  function parseCountry(data) {
    if (!data) return '';
    var cc = data.country_code || data.countryCode || '';
    cc = String(cc).toUpperCase().trim();
    return cc.length === 2 ? cc : '';
  }

  function clientGeoCheck() {
    return fetchJson('https://ipwho.is/', 3500)
      .then(function (data) {
        var cc = parseCountry(data);
        if (!cc || data.success === false) throw new Error('no cc');
        if (ALLOWED[cc]) return { ok: true, blocked: false, country: cc };
        return { ok: false, blocked: true, country: cc };
      })
      .catch(function () {
        return fetchJson('https://ipapi.co/json/', 3500).then(function (data) {
          var cc = parseCountry(data);
          if (!cc || data.error) throw new Error('no cc');
          if (ALLOWED[cc]) return { ok: true, blocked: false, country: cc };
          return { ok: false, blocked: true, country: cc };
        });
      });
  }

  function serverGeoCheck() {
    var url = geoCheckUrl();
    if (!url) return Promise.reject(new Error('no url'));
    return fetchJson(url, 4500).then(function (data) {
      if (!data || typeof data !== 'object') throw new Error('bad json');
      return data;
    });
  }

  function checkGeo() {
    return new Promise(function (resolve) {
      var done = false;
      var pending = 2;
      var uncertain = null;

      function finish(result) {
        if (done) return;
        done = true;
        resolve(result);
      }

      function onResult(data) {
        pending -= 1;
        if (!data) {
          if (pending <= 0) finish(uncertain || { ok: true, blocked: false, uncertain: true });
          return;
        }
        if (data.blocked) {
          finish(data);
          return;
        }
        if (data.ok && !data.uncertain) {
          finish(data);
          return;
        }
        if (data.ok && data.uncertain) uncertain = data;
        if (pending <= 0) finish(uncertain || { ok: true, blocked: false, uncertain: true });
      }

      serverGeoCheck().then(onResult).catch(function () {
        onResult(null);
      });

      clientGeoCheck().then(onResult).catch(function () {
        onResult(null);
      });

      setTimeout(function () {
        finish(uncertain || { ok: true, blocked: false, uncertain: true });
      }, CHECK_MS);
    });
  }

  function pass() {
    saveSession();
    location.replace(getNext());
  }

  function start() {
    if (hasValidSession()) {
      location.replace(getNext());
      return;
    }

    render('check');

    checkGeo()
      .then(function (data) {
        if (data && data.blocked) {
          clearSession();
          render('blocked');
          return;
        }
        pass();
      })
      .catch(function () {
        pass();
      });
  }

  start();
})();
