(function () {
  'use strict';

  var cfg = window.LSR_CAPTCHA || {};
  var KEY = 'lsr_ok';
  var UNTIL = 'lsr_until';
  var TTL = (cfg.ttlHours || 24) * 3600 * 1000;

  function store() {
    try {
      return window.localStorage;
    } catch (e) {
      return null;
    }
  }

  function okSession() {
    var s = store();
    if (!s) return false;
    return s.getItem(KEY) === '1' && Number(s.getItem(UNTIL) || 0) > Date.now();
  }

  function saveOk() {
    var s = store();
    if (!s) return;
    s.setItem(KEY, '1');
    s.setItem(UNTIL, String(Date.now() + TTL));
  }

  function openSite() {
    window.__lsrCaptchaOk = true;
    saveOk();
    document.documentElement.classList.remove('lsr-gate-pending');
    var el = document.getElementById('lsr-gate');
    if (el && el.parentNode) el.parentNode.removeChild(el);
    try {
      window.dispatchEvent(new Event('lsr-captcha-ok'));
    } catch (e) {}
  }

  if (okSession()) {
    window.__lsrCaptchaOk = true;
    document.documentElement.classList.remove('lsr-gate-pending');
    try {
      window.dispatchEvent(new Event('lsr-captcha-ok'));
    } catch (e) {}
  } else {
    openSite();
  }
})();
