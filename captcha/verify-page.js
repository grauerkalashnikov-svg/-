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

  saveOk();
  location.replace(nextPath());
})();
