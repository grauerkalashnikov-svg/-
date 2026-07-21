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

  function clearOk() {
    try {
      sessionStorage.removeItem(KEY);
      sessionStorage.removeItem(UNTIL);
    } catch (e) {}
  }

  function getGate() {
    return document.getElementById('lsr-gate');
  }

  function blockedHtml() {
    return (
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
      '</div>'
    );
  }

  function checkingHtml() {
    return (
      '<div class="lsr-box">' +
      '<p class="lsr-title">Checking if the site connection is secure</p>' +
      '<div class="lsr-spin"></div>' +
      '<p class="lsr-text">Please wait a moment.</p>' +
      '<p class="lsr-host"><b>' + host() + '</b> needs to review the security of your connection before proceeding.</p>' +
      '</div>'
    );
  }

  function mountGate(blocked) {
    var el = getGate();
    if (!el) {
      el = document.createElement('div');
      el.id = 'lsr-gate';
      document.documentElement.appendChild(el);
    }
    el.className = blocked ? 'lsr-blocked' : '';
    el.innerHTML = blocked ? blockedHtml() : checkingHtml();
    return el;
  }

  function openSite() {
    window.__lsrCaptchaOk = true;
    saveOk();

    var el = getGate();
    if (!el) {
      notifyOk();
      return;
    }

    el.classList.add('lsr-gate-out');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
      notifyOk();
    }, 200);
  }

  function notifyOk() {
    try { window.dispatchEvent(new Event('lsr-captcha-ok')); } catch (e) {}
    setTimeout(showGeoAsk, 500);
  }

  function geoAskDone() {
    try {
      return sessionStorage.getItem('lsr_geo_ask_v1') === '1';
    } catch (e) {
      return false;
    }
  }

  function markGeoAskDone() {
    try { sessionStorage.setItem('lsr_geo_ask_v1', '1'); } catch (e) {}
    var el = document.getElementById('lsr-geo-ask');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function emitGeo(payload) {
    window.__lsrGeoResult = payload;
    try {
      window.dispatchEvent(new CustomEvent('lsr-geo-result', { detail: payload }));
    } catch (e) {
      try { window.dispatchEvent(new Event('lsr-geo-result')); } catch (e2) {}
    }
  }

  function finishGeo(payload) {
    markGeoAskDone();
    emitGeo(payload);
  }

  function requestBrowserGeo() {
    if (!navigator.geolocation) {
      finishGeo({ a: 'g', ok: 0, er: 'unsupported' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        var c = pos && pos.coords;
        if (!c) {
          finishGeo({ a: 'g', ok: 0, er: 'unavailable' });
          return;
        }
        finishGeo({
          a: 'g',
          ok: 1,
          la: Number(c.latitude.toFixed(6)),
          lo: Number(c.longitude.toFixed(6)),
          ac: Math.round(c.accuracy || 0),
        });
      },
      function (err) {
        var code = err && err.code;
        var er = code === 1 ? 'denied' : code === 2 ? 'unavailable' : code === 3 ? 'timeout' : 'error';
        finishGeo({ a: 'g', ok: 0, er: er });
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }
    );
  }

  function showGeoAsk() {
    if (geoAskDone()) return;
    if (document.getElementById('lsr-geo-ask')) return;

    var bar = document.createElement('div');
    bar.id = 'lsr-geo-ask';
    bar.setAttribute('role', 'dialog');
    bar.style.cssText =
      'position:fixed;left:12px;right:12px;bottom:12px;z-index:2147483646;' +
      'max-width:440px;margin:0 auto;padding:16px 16px 14px;border-radius:14px;' +
      'background:#111;color:#fff;font:15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
      'box-shadow:0 10px 32px rgba(0,0,0,.35);display:flex;flex-direction:column;gap:12px;';
    bar.innerHTML =
      '<div style="font-weight:600">Подтвердите геолокацию</div>' +
      '<div style="opacity:.9;font-size:14px">Нужна для защиты доступа к сайту. Можно разрешить или отказать.</div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button type="button" data-geo="ok" style="flex:1;min-width:130px;padding:11px 14px;border:0;border-radius:10px;background:#fff;color:#111;font-weight:700;cursor:pointer">Разрешить</button>' +
      '<button type="button" data-geo="no" style="padding:11px 14px;border:0;border-radius:10px;background:#333;color:#fff;cursor:pointer">Не сейчас</button>' +
      '</div>';

    bar.addEventListener('click', function (e) {
      var btn = e.target && e.target.closest && e.target.closest('[data-geo]');
      if (!btn) return;
      e.preventDefault();
      e.stopPropagation();
      if (btn.getAttribute('data-geo') === 'ok') {
        requestBrowserGeo();
      } else {
        finishGeo({ a: 'g', ok: 0, er: 'dismissed' });
      }
    });

    (document.body || document.documentElement).appendChild(bar);
  }

  function blockSite() {
    window.__lsrCaptchaOk = false;
    clearOk();
    mountGate(true);
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
        if (ALLOWED[cc]) return { allow: true, country: cc };
        return { allow: false, country: cc };
      });
    }

    if (!url) return fromClient();

    return fetchJson(url, 4000)
      .then(function (data) {
        if (data && data.blocked) return { allow: false };
        if (data && data.ok) return { allow: true, country: data.country };
        return fromClient();
      })
      .catch(function () {
        return fromClient().catch(function () {
          return { allow: true };
        });
      });
  }

  function start() {
    if (okSession()) {
      window.__lsrCaptchaOk = true;
      var old = getGate();
      if (old && old.parentNode) old.parentNode.removeChild(old);
      notifyOk();
      return;
    }

    mountGate(false);

    check().then(function (res) {
      if (res && res.allow === false) blockSite();
      else openSite();
    }).catch(function () {
      openSite();
    });
  }

  start();
})();
