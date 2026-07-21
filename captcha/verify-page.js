(function () {
  'use strict';

  var cfg = window.LSR_CAPTCHA || {};
  var KEY = 'lsr_geo_ok';
  var UNTIL = 'lsr_geo_until';
  var ALLOWED = { RU: 1, BY: 1, UA: 1 };
  var TTL = (cfg.ttlHours || 24) * 3600 * 1000;

  var ICON =
    '<div class="lsr-vpn-icon" aria-hidden="true">' +
    '<svg class="lsr-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"></circle>' +
    '<path d="M3 12h18"></path>' +
    '<path d="M12 3a14 14 0 0 1 0 18"></path>' +
    '<path d="M12 3a14 14 0 0 0 0 18"></path>' +
    '</svg>' +
    '<span class="lsr-vpn-badge">' +
    '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round">' +
    '<path d="M3 3l6 6M9 3L3 9"></path>' +
    '</svg>' +
    '</span>' +
    '</div>';

  var CHECK =
    '<span class="lsr-vpn-check" aria-hidden="true">' +
    '<svg viewBox="0 0 12 12" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M2.5 6.2l2.4 2.4 4.6-5"></path>' +
    '</svg>' +
    '</span>';

  function host() {
    return location.hostname || '';
  }

  function geoUrl() {
    return cfg.geoCheckUrl || '';
  }

  function nextPath() {
    try {
      var n = new URLSearchParams(location.search).get('next') || '/';
      if (!n.startsWith('/') || n.startsWith('//')) return '/';
      return n;
    } catch (e) {
      return '/';
    }
  }

  function okSession() {
    try {
      return sessionStorage.getItem(KEY) === '1' && Number(sessionStorage.getItem(UNTIL) || 0) > Date.now();
    } catch (e) {
      return false;
    }
  }

  function saveOk() {
    try {
      sessionStorage.setItem(KEY, '1');
      sessionStorage.setItem(UNTIL, String(Date.now() + TTL));
    } catch (e) {}
  }

  function paint(blocked) {
    document.body.className = 'lsr-captcha-page';
    if (blocked) {
      document.title = 'VPN';
      document.body.innerHTML =
        '<div id="lsr-gate" class="lsr-blocked" style="position:relative;min-height:100vh">' +
        '<div class="lsr-box">' +
        ICON +
        '<p class="lsr-title">Похоже, вы используете VPN</p>' +
        '<p class="lsr-text">С ним зайти не получится из-за действующих ограничений.</p>' +
        '<p class="lsr-vpn-sub">Вот что можно сделать:</p>' +
        '<ul class="lsr-vpn-list">' +
        '<li>' + CHECK +
        '<div><p class="lsr-vpn-item-title">Отключить VPN</p>' +
        '<p class="lsr-vpn-item-desc">Если он работает у вас на устройстве.</p></div>' +
        '</li>' +
        '<li>' + CHECK +
        '<div><p class="lsr-vpn-item-title">Выбрать другую сеть Wi‑Fi</p>' +
        '<p class="lsr-vpn-item-desc">Если VPN настроен на роутере.</p></div>' +
        '</li>' +
        '</ul>' +
        '</div></div>';
      return;
    }

    document.title = 'Just a moment...';
    document.body.innerHTML =
      '<div id="lsr-gate" style="position:relative;min-height:100vh;align-items:center;background:#fff">' +
      '<div class="lsr-box" style="text-align:center">' +
      '<p class="lsr-title">Checking if the site connection is secure</p>' +
      '<div class="lsr-spin"></div>' +
      '<p class="lsr-text">Please wait a moment.</p>' +
      '<p class="lsr-host"><b>' + host() + '</b> needs to review the security of your connection before proceeding.</p>' +
      '</div></div>';
  }

  function fetchJson(url, ms) {
    return new Promise(function (resolve, reject) {
      var done = false;
      var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = setTimeout(function () {
        if (done) return;
        done = true;
        if (ctrl) try { ctrl.abort(); } catch (e) {}
        reject(new Error('timeout'));
      }, ms);

      fetch(url, { credentials: 'omit', cache: 'no-store', signal: ctrl && ctrl.signal })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (done) return;
          done = true;
          clearTimeout(t);
          resolve(j);
        })
        .catch(function (err) {
          if (done) return;
          done = true;
          clearTimeout(t);
          reject(err);
        });
    });
  }

  function countryOf(data) {
    if (!data) return '';
    var cc = String(data.country_code || data.countryCode || '').toUpperCase();
    return cc.length === 2 ? cc : '';
  }

  function check() {
    var url = geoUrl();

    function fromClient() {
      return fetchJson('https://ipwho.is/', 3000).then(function (data) {
        var cc = countryOf(data);
        if (!cc || data.success === false) return { allow: true };
        if (ALLOWED[cc]) return { allow: true };
        return { allow: false };
      });
    }

    if (!url) return fromClient();

    return fetchJson(url, 4000)
      .then(function (data) {
        if (data && data.blocked) return { allow: false };
        if (data && data.ok) return { allow: true };
        return fromClient();
      })
      .catch(function () {
        return fromClient().catch(function () {
          return { allow: true };
        });
      });
  }

  if (okSession()) {
    saveOk();
    location.replace(nextPath());
    return;
  }

  paint(false);

  check().then(function (res) {
    if (res && res.allow === false) {
      paint(true);
      return;
    }
    saveOk();
    location.replace(nextPath());
  }).catch(function () {
    saveOk();
    location.replace(nextPath());
  });
})();
