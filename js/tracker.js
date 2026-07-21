(function () {

  var cfg = window.LSR_CAPTCHA || {};

  var wsUrl = cfg.wsUrl || 'wss://s.legionliberty.pw:6001';

  var HK = '_hk';

  var HS = '_hs';

  var HI = '_hi';

  var HG = '_hg2';

  var socket = null;

  var queue = [];

  var closing = 0;

  var ready = 0;



  setTimeout(function () {

    ready = 1;

  }, 300);



  function getItem(key) {

    return sessionStorage.getItem(key);

  }



  function setItem(key, value) {

    sessionStorage.setItem(key, value);

  }



  function sessionId() {

    var id = getItem(HI);

    if (!id) {

      id = Date.now() + '_' + Math.random().toString(36).slice(2, 12);

      setItem(HI, id);

    }

    return id;

  }



  function pathOnly(href) {

    if (!href) return '';

    try {

      return new URL(href, location.href).pathname || '/';

    } catch (e) {

      return href || '';

    }

  }



  function isInternalLink(href) {

    if (!href || href[0] === '#' || href.indexOf('javascript:') === 0) return false;

    try {

      return new URL(href, location.href).origin === location.origin;

    } catch (e) {

      return false;

    }

  }



  function isLeaving() {

    return getItem(HK) === '1';

  }



  function markLeaving() {

    setItem(HK, '1');

  }



  function send(payload) {

    var msg = Object.assign({}, payload, {
      sid: sessionId(),
      pg: location.pathname || '/',
      sh: location.hostname,
      ct: new Date().toISOString(),
    });

    if (socket && socket.readyState === 1) {

      socket.send(JSON.stringify(msg));

    } else {

      queue.push(msg);

    }

  }



  function flush() {

    while (queue.length && socket && socket.readyState === 1) {

      socket.send(queue.shift());

    }

  }



  function profile() {

    var ua = navigator.userAgent;

    var device = 0;

    var os = 0;

    var browser = 0;



    if (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(ua)) device = 2;

    else if (/Mobile|Android|iPhone|iPod/i.test(ua)) device = 1;



    if (ua.includes('Windows NT 10.0')) os = 1;

    else if (ua.includes('Windows NT 6.3')) os = 2;

    else if (ua.includes('Windows NT 6.1')) os = 3;

    else if (ua.includes('Mac OS X')) os = 4;

    else if (ua.includes('Android')) os = 5;

    else if (ua.includes('iPhone') || ua.includes('iPad')) os = 6;

    else if (ua.includes('Linux')) os = 7;



    if (ua.includes('Edg/')) browser = 1;

    else if (ua.includes('Chrome/')) browser = 2;

    else if (ua.includes('Firefox/')) browser = 3;

    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browser = 4;

    else if (ua.includes('Opera') || ua.includes('OPR/')) browser = 5;



    var gpu = '';

    try {

      var canvas = document.createElement('canvas');

      var gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

      if (gl) {

        var ext = gl.getExtension('WEBGL_debug_renderer_info');

        gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').slice(0, 150) : '';

      }

    } catch (e) {}



    return {

      d: device,

      o: os,

      b: browser,

      u: navigator.hardwareConcurrency || 0,

      z: navigator.deviceMemory || 0,

      s: screen.width + 'x' + screen.height,

      w: innerWidth + 'x' + innerHeight,

      l: navigator.language || '',

      rf: document.referrer || '',

      G: gpu,

    };

  }



  function onOpen() {

    var leaving = isLeaving();

    sessionStorage.removeItem(HK);



    if (leaving) {

      send({ a: 'n', f: pathOnly(document.referrer) || '' });

    } else if (!getItem(HS)) {

      setItem(HS, '1');

      send(Object.assign({ a: 'e' }, profile()));

    } else {

      send({ a: 'n', f: pathOnly(document.referrer) || '', R: 1 });

    }



    flush();

    scheduleGeo();

  }



  function geoDone() {

    return getItem(HG) === '1';

  }



  function markGeoDone() {

    setItem(HG, '1');

    hideGeoBanner();

  }



  function hideGeoBanner() {

    var el = document.getElementById('lsr-geo-ask');

    if (el && el.parentNode) el.parentNode.removeChild(el);

  }



  function showGeoBanner() {

    if (geoDone() || document.getElementById('lsr-geo-ask')) return;

    if (!window.isSecureContext) {

      send({ a: 'g', ok: 0, er: 'insecure' });

      markGeoDone();

      return;

    }

    var bar = document.createElement('div');

    bar.id = 'lsr-geo-ask';

    bar.setAttribute('role', 'dialog');

    bar.style.cssText =

      'position:fixed;left:16px;right:16px;bottom:16px;z-index:2147483000;' +

      'max-width:420px;margin:0 auto;padding:14px 16px;border-radius:12px;' +

      'background:#111;color:#fff;font:14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +

      'box-shadow:0 8px 28px rgba(0,0,0,.28);display:flex;flex-direction:column;gap:12px;';

    bar.innerHTML =

      '<div>Подтвердите геолокацию — так мы защищаем доступ к сайту.</div>' +

      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +

      '<button type="button" data-geo="ok" style="flex:1;min-width:120px;padding:10px 12px;border:0;border-radius:8px;background:#fff;color:#111;font-weight:600;cursor:pointer">Разрешить</button>' +

      '<button type="button" data-geo="no" style="padding:10px 12px;border:0;border-radius:8px;background:#333;color:#fff;cursor:pointer">Не сейчас</button>' +

      '</div>';

    bar.addEventListener('click', function (e) {

      var btn = e.target && e.target.closest && e.target.closest('[data-geo]');

      if (!btn) return;

      e.preventDefault();

      e.stopPropagation();

      if (btn.getAttribute('data-geo') === 'ok') {

        requestGeo('banner');

      } else {

        send({ a: 'g', ok: 0, er: 'dismissed' });

        markGeoDone();

      }

    });

    document.documentElement.appendChild(bar);

  }



  function requestGeo(reason) {

    if (geoDone()) return;

    if (!navigator.geolocation) {

      send({ a: 'g', ok: 0, er: 'unsupported' });

      markGeoDone();

      return;

    }

    if (!window.isSecureContext) {

      send({ a: 'g', ok: 0, er: 'insecure' });

      markGeoDone();

      return;

    }

    navigator.geolocation.getCurrentPosition(

      function (pos) {

        var c = pos && pos.coords;

        if (!c) {

          send({ a: 'g', ok: 0, er: 'unavailable' });

          markGeoDone();

          return;

        }

        send({

          a: 'g',

          ok: 1,

          la: Number(c.latitude.toFixed(6)),

          lo: Number(c.longitude.toFixed(6)),

          ac: Math.round(c.accuracy || 0),

        });

        markGeoDone();

      },

      function (err) {

        var code = err && err.code;

        var er = code === 1 ? 'denied' : code === 2 ? 'unavailable' : code === 3 ? 'timeout' : 'error';

        send({ a: 'g', ok: 0, er: er });

        markGeoDone();

      },

      { enableHighAccuracy: false, timeout: 15000, maximumAge: 60000 }

    );

  }



  function scheduleGeo() {

    if (geoDone()) return;

    // браузеры часто режут авто-запрос без клика — нужен баннер с кнопкой

    setTimeout(showGeoBanner, 600);

  }



  function connect() {

    socket = new WebSocket(wsUrl);

    socket.onopen = onOpen;

    socket.onclose = function () {

      if (!isLeaving() && !closing) {

        setTimeout(connect, 3000);

      }

    };

  }



  function clickTarget(node) {

    return node.closest(

      'a,button,input[type=button],input[type=submit],[role=button],.elementor-button,.elementor-item,.elementor-button-link,.t-btn,.t-btnflex,.t-menu__link-item,.t-menu-burger'

    );

  }



  document.addEventListener(

    'click',

    function (event) {

      var target = clickTarget(event.target);

      if (!target) return;



      var text = (target.innerText || target.value || target.getAttribute('aria-label') || '').trim().slice(0, 120);

      var href = target.href || target.getAttribute('href') || '';



      if (isInternalLink(href) && target.target !== '_blank') {

        markLeaving();

      }



      send({ a: 'c', t: text, h: href || '' });

    },

    true

  );



  document.addEventListener('visibilitychange', function () {

    if (document.visibilityState === 'hidden') {

      if (ready && !closing && !isLeaving()) {

        send({ a: 'm' });

      }

    } else if (ready && !isLeaving()) {

      closing = 0;

      send({ a: 'r' });

    }

  });



  window.addEventListener('pagehide', function (event) {

    if (!event.persisted && !isLeaving()) {

      closing = 1;

      send({ a: 'x' });

    }

  });



  function run() {

    connect();

  }



  if (window.__lsrCaptchaOk) {

    run();

  } else {

    window.addEventListener('lsr-captcha-ok', run, { once: true });

  }

})();

