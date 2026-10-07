(function () {
  'use strict';
  var COLORS = [
    { id: 'gold', name: 'Golden', hex: '#F6B73C' },
    { id: 'ruby', name: 'Ruby red', hex: '#E5484D' },
    { id: 'lotus', name: 'Lotus pink', hex: '#F27BA8' },
    { id: 'jade', name: 'Jade green', hex: '#35C98A' },
    { id: 'sky', name: 'Sky blue', hex: '#4FA3FF' },
    { id: 'violet', name: 'Royal violet', hex: '#A77BFF' }
  ];
  var BY_ID = {}; COLORS.forEach(function (c) { BY_ID[c.id] = c; });
  var MAX_TEXT = 150, MAX_NAME = 40, COOLDOWN_MS = 15000;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var $ = function (id) { return document.getElementById(id); };
  var scene = $('scene'), hero = $('hero'), layer = $('lanterns'), ctaWrap = $('ctaWrap');

  // Delete tokens for wishes made in this browser (lets people remove their own wish)
  function loadMine() {
    try { return JSON.parse(localStorage.getItem('lantern-mine') || '{}') || {}; } catch (e) { return {}; }
  }
  function saveMine() {
    try { localStorage.setItem('lantern-mine', JSON.stringify(state.mine)); } catch (e) { /* storage blocked: fine */ }
  }

  var state = {
    loaded: false, online: true, version: null, adminKey: null, mine: loadMine(),
    wishes: [], els: new Map(), rising: new Set(), current: null, lastSent: 0, sending: false
  };

  /* ---------- Lantern drawing (color comes only from the whitelist) ---------- */
  function lanternSVG(hex, detailed) {
    return '<svg viewBox="0 0 60 84" aria-hidden="true" focusable="false">' +
      '<path d="M8 6 Q30 -2 52 6 L45 64 Q30 70 15 64 Z" fill="' + hex + '"/>' +
      (detailed ? '<path d="M14 10 Q30 4 46 10 L41 60 Q30 64 19 60 Z" fill="#FFF3C8" opacity="0.3"/>' +
        '<path d="M22 4 L24 66 M38 4 L36 66" stroke="#3A2414" stroke-opacity="0.18" stroke-width="1.5" fill="none"/>' : '') +
      '<ellipse cx="30" cy="40" rx="9" ry="16" fill="#FFF8E0" opacity="0.6"/>' +
      '<path d="M15 64 Q30 70 45 64 L42 70 Q30 74 18 70 Z" fill="#2B1A12" opacity="0.5"/>' +
      '<path d="M30 71 Q26 77 30 83 Q34 77 30 71 Z" fill="#FFD27A"/></svg>';
  }

  /* ---------- Bagan skyline ---------- */
  function shape(cx, G, pts) {
    var f = function (n) { return n.toFixed(1); };
    var d = 'M' + f(cx + pts[0][0]) + ' ' + f(G + pts[0][1]), i, p, q;
    for (i = 1; i < pts.length; i++) {
      p = pts[i];
      d += p.length === 4 ? ' Q' + f(cx + p[2]) + ' ' + f(G + p[3]) + ' ' + f(cx + p[0]) + ' ' + f(G + p[1]) : ' L' + f(cx + p[0]) + ' ' + f(G + p[1]);
    }
    for (i = pts.length - 1; i >= 1; i--) {
      p = pts[i]; q = pts[i - 1];
      d += p.length === 4 ? ' Q' + f(cx - p[2]) + ' ' + f(G + p[3]) + ' ' + f(cx - q[0]) + ' ' + f(G + q[1]) : ' L' + f(cx - q[0]) + ' ' + f(G + q[1]);
    }
    return d + ' Z';
  }
  function stupa(cx, G, w, h) {
    return shape(cx, G, [[-w / 2, 2], [-w / 2, -.07 * h], [-.4 * w, -.07 * h], [-.4 * w, -.14 * h], [-.31 * w, -.14 * h], [-.31 * w, -.21 * h], [-.24 * w, -.21 * h],
      [-.06 * w, -.58 * h, -.27 * w, -.5 * h], [-.07 * w, -.62 * h], [-.035 * w, -.65 * h], [-.012 * w, -.92 * h, -.03 * w, -.8 * h], [0, -h]]);
  }
  function temple(cx, G, w, h) {
    return shape(cx, G, [[-w / 2, 2], [-w / 2, -.28 * h], [-.42 * w, -.28 * h], [-.42 * w, -.34 * h], [-.34 * w, -.34 * h], [-.34 * w, -.44 * h], [-.26 * w, -.44 * h],
      [-.26 * w, -.5 * h], [-.2 * w, -.5 * h], [-.05 * w, -.86 * h, -.2 * w, -.74 * h], [-.03 * w, -.88 * h], [-.01 * w, -.96 * h], [0, -h]]);
  }
  function skyline(G, list, hill) {
    var d = 'M0 ' + G + ' Q360 ' + (G - hill) + ' 720 ' + G + ' Q1080 ' + (G + hill) + ' 1440 ' + (G - 4) + ' L1440 320 L0 320 Z';
    list.forEach(function (b) { d += ' ' + (b[0] === 't' ? temple(b[1], G, b[2], b[3]) : stupa(b[1], G, b[2], b[3])); });
    return d;
  }
  $('farSkyline').setAttribute('d', skyline(282, [['s', 60, 60, 90], ['t', 240, 100, 110], ['s', 470, 70, 125], ['s', 640, 40, 70], ['t', 830, 90, 100], ['s', 990, 70, 118], ['t', 1140, 80, 96], ['s', 1300, 52, 82], ['s', 1410, 40, 64]], 6));
  $('nearSkyline').setAttribute('d', skyline(294, [['t', 140, 150, 172], ['s', 310, 80, 120], ['s', 420, 46, 76], ['t', 560, 110, 128], ['s', 720, 120, 196], ['t', 910, 170, 188], ['s', 1065, 60, 96], ['t', 1220, 130, 150], ['s', 1370, 86, 136]], 8));

  (function candles() {
    var host = $('candles'), s = 17;
    function r() { s = (s * 9301 + 49297) % 233280; return s / 233280; }
    for (var i = 0; i < 26; i++) {
      var c = document.createElement('span');
      c.style.left = (2 + r() * 96).toFixed(1) + '%';
      c.style.bottom = Math.round(8 + r() * 16) + 'px';
      c.style.animationDelay = (r() * 1.6).toFixed(2) + 's';
      host.appendChild(c);
    }
  })();

  /* ---------- Stars + fireworks (canvas) ---------- */
  var celebrate = function () {};
  (function sky() {
    var cv = $('sky'), ctx = cv.getContext('2d'), stars = [], parts = [], W = 0, H = 0, dpr = 1, next = 800, last = 0;
    var FW = [['#F6C35B', '#FFE9B0'], ['#F27BA8', '#FFD1E3'], ['#7FC8FF', '#E6F4FF'], ['#35C98A', '#D7FFE9'], ['#B45CFF', '#E9CCFF']];
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = cv.clientWidth; H = cv.clientHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(220, W * H / 7000));
      stars = [];
      for (var i = 0; i < n; i++) stars.push({ x: Math.random() * W, y: Math.random() * H * .72, r: Math.random() < .85 ? .5 + Math.random() * .6 : 1 + Math.random() * .7, p: Math.random() * 6.28, s: .6 + Math.random() * 1.6 });
      if (reduceMotion) draw(0);
    }
    function burst(big, tint) {
      var x = W * (.06 + Math.random() * .88), y = H * (.06 + Math.random() * (big ? .45 : .32)), pal = FW[Math.floor(Math.random() * FW.length)];
      if (tint) pal = [tint, pal[1]];
      var n = (W < 600 ? 40 : 64) * (big ? 1.4 : 1), sp = (W < 600 ? 2.4 : 3.2) * (big ? 1.25 : 1);
      if (parts.length > 4000) return;
      for (var i = 0; i < n; i++) {
        var a = (i / n) * Math.PI * 2 + Math.random() * .1, v = sp * (.55 + Math.random() * .45);
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: (big ? 85 : 70) + Math.random() * 30, c: pal[i % 2] });
      }
    }
    // Celebration: a sky full of fireworks when a new wish arrives
    celebrate = function (tint) {
      if (reduceMotion) return;
      var count = W < 600 ? 9 : 16;
      for (var k = 0; k < count; k++) {
        setTimeout(function () { burst(true, Math.random() < .4 ? tint : null); }, k * 180 + Math.random() * 220);
      }
      last = performance.now() + 2500;
    };
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = '#FFF6DA';
      for (var i = 0; i < stars.length; i++) {
        var st = stars[i];
        ctx.globalAlpha = reduceMotion ? .7 : .35 + .65 * (0.5 + 0.5 * Math.sin(t / 1000 * st.s + st.p));
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, 6.283); ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      for (var j = parts.length - 1; j >= 0; j--) {
        var p = parts[j];
        p.life++; p.vx *= .985; p.vy = p.vy * .985 + .025; p.x += p.vx; p.y += p.vy;
        if (p.life > p.max) { parts.splice(j, 1); continue; }
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
        ctx.strokeStyle = p.c; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    function loop(t) {
      if (!document.hidden) {
        if (t - last > next) { burst(); last = t; next = 1400 + Math.random() * 1600; }
        draw(t);
      }
      requestAnimationFrame(loop);
    }
    window.addEventListener('resize', resize);
    resize();
    if (!reduceMotion) requestAnimationFrame(loop);
  })();

  /* ---------- Helpers ---------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    var out = [], x = h >>> 0;
    for (var k = 0; k < 4; k++) { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; out.push(x / 4294967296); }
    return out;
  }
  function timeAgo(ms) {
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'Just now';
    if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) { var h = Math.floor(s / 3600); return h + (h === 1 ? ' hour ago' : ' hours ago'); }
    var d = Math.floor(s / 86400);
    if (d < 7) return d + (d === 1 ? ' day ago' : ' days ago');
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function clean(id, data) {
    if (!data || typeof data.text !== 'string') return null;
    var text = data.text.trim().slice(0, MAX_TEXT);
    if (!text) return null;
    return {
      id: id, text: text,
      name: typeof data.name === 'string' ? data.name.trim().slice(0, MAX_NAME) : '',
      color: BY_ID[data.color] ? data.color : 'gold',
      createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
      uid: typeof data.uid === 'string' ? data.uid : null
    };
  }
  function toast(msg) {
    var host = $('toastHost');
    host.textContent = '';
    var t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = '<svg width="14" height="18" viewBox="0 0 60 84" aria-hidden="true"><path d="M8 6 Q30 -2 52 6 L45 64 Q30 70 15 64 Z" fill="#F6B73C"/></svg>';
    t.appendChild(document.createTextNode(msg));
    host.appendChild(t);
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { host.textContent = ''; }, 4500);
  }
  function setStatus(msg) { $('status').textContent = msg || ''; }

  /* ---------- Lantern layout ---------- */
  function visibleWishes() {
    var cap = scene.clientWidth >= 900 ? 60 : 24;
    return state.wishes.slice(0, cap);
  }
  function renderLanterns() {
    var list = visibleWishes(), keep = new Set();
    list.forEach(function (w) {
      keep.add(w.id);
      var el = state.els.get(w.id);
      if (!el) {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'lantern';
        el.innerHTML = '<div class="bob">' + lanternSVG(BY_ID[w.color].hex, true) + '</div>';
        el.addEventListener('click', function () { openRead(el._wish); });
        layer.appendChild(el);
        state.els.set(w.id, el);
        if (state.rising.has(w.id) && !reduceMotion) {
          el.classList.add('rising');
          el.addEventListener('animationend', function () { el.classList.remove('rising'); }, { once: true });
        }
      }
      el._wish = w;
      el.setAttribute('aria-label', 'Read the wish from ' + (w.name || 'a friend'));
      el.classList.toggle('mine', !!state.mine[w.id]);
    });
    state.els.forEach(function (el, id) { if (!keep.has(id)) { el.remove(); state.els.delete(id); } });
    state.rising.clear();
    layout();
  }
  function seededRandom(id) {
    var a = Math.floor(hash(id)[0] * 4294967296) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function layout() {
    var W = scene.clientWidth, H = scene.clientHeight, wide = W >= 900;
    var sr = scene.getBoundingClientRect();
    var skyTop = H - Math.min(320, Math.max(170, H * .32)) * .55;
    var topLimit = (document.querySelector('.top').getBoundingClientRect().bottom - sr.top) + 6;
    var base = wide ? 50 : 38;

    // Areas lanterns must not cover: each line of the hero text, and the button
    var blocks = Array.prototype.slice.call(hero.children);
    if (!wide) blocks.push(ctaWrap);
    var avoid = blocks.map(function (b) {
      var r = b.getBoundingClientRect();
      return { l: r.left - sr.left - 14, t: r.top - sr.top - 10, r: r.right - sr.left + 14, b: r.bottom - sr.top + 10 };
    }).filter(function (a) { return a.r > a.l && a.b > a.t; });

    // Place oldest first, so a new wish never moves the lanterns already in the sky
    var placed = [];
    var order = Array.from(state.els.keys()).sort(function (a, b) {
      return (state.els.get(a)._wish.createdAt || 0) - (state.els.get(b)._wish.createdAt || 0);
    });
    order.forEach(function (id) {
      var el = state.els.get(id), rnd = seededRandom(id), r = hash(id);
      var size = Math.round(base * (.62 + rnd() * .62)), h = size * 1.45;
      var minX = 10, maxX = W - size - 10, minY = topLimit, maxY = Math.max(minY + 20, skyTop - h);
      var best = null, bestScore = -Infinity;
      for (var k = 0; k < 40; k++) {
        var x = minX + rnd() * Math.max(0, maxX - minX), y = minY + rnd() * (maxY - minY);
        var hit = avoid.some(function (a) { return x < a.r && x + size > a.l && y < a.b && y + h > a.t; });
        var gap = Infinity;
        placed.forEach(function (p) {
          var dx = (x + size / 2) - p.cx, dy = (y + h / 2) - p.cy;
          gap = Math.min(gap, Math.sqrt(dx * dx + dy * dy) - (size + p.s) * .62);
        });
        var score = (hit ? -10000 : 0) + Math.min(gap, 400);
        if (score > bestScore) { bestScore = score; best = { x: x, y: y }; }
        if (!hit && gap > size * .4) break;
      }
      placed.push({ cx: best.x + size / 2, cy: best.y + h / 2, s: size });
      var x = best.x, y = best.y;
      el.style.opacity = (.78 + (size / base - .62) / .62 * .22).toFixed(2);
      el.style.zIndex = String(size);
      el.style.width = size + 'px';
      el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
      el.style.setProperty('--rise', Math.round(H - y + 40) + 'px');
      el.style.filter = 'drop-shadow(0 0 ' + Math.round(size * .38) + 'px ' + BY_ID[el._wish.color].hex + ')';
      var bob = el.firstChild;
      bob.style.animationDelay = (-r[3] * 6).toFixed(2) + 's';
      bob.style.animationDuration = (5 + r[3] * 2.4).toFixed(2) + 's';
    });
  }
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(renderLanterns, 120); });

  function updateCount() {
    var n = state.total != null ? state.total : state.wishes.length;
    $('count').textContent = String(n);
    if (state.loaded && n === 0) $('hint').textContent = 'No lanterns yet. Be the first to light up the sky.';
    else $('hint').textContent = 'Tap any lantern to read its wish';
  }

  /* ---------- Dialogs ---------- */
  function openDialog(d) { if (!d.open) d.showModal(); }
  document.querySelectorAll('[data-close]').forEach(function (b) {
    b.addEventListener('click', function () { b.closest('dialog').close(); });
  });
  document.querySelectorAll('dialog').forEach(function (d) {
    d.addEventListener('click', function (e) { if (e.target === d) d.close(); });
  });


  /* ---------- API ---------- */
  function api(method, path, body, headers) {
    var opts = { method: method, headers: Object.assign({ 'Accept': 'application/json' }, headers || {}) };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var e = new Error(data.error || 'Request failed'); e.status = res.status; e.data = data; throw e; }
        return data;
      });
    });
  }

  // Wish form
  var swHost = $('swatches');
  COLORS.forEach(function (c, i) {
    var lab = document.createElement('label');
    lab.className = 'swatch';
    var input = document.createElement('input');
    input.type = 'radio'; input.name = 'color'; input.value = c.id; input.checked = i === 0;
    input.setAttribute('aria-label', c.name);
    var dot = document.createElement('span');
    dot.style.background = c.hex;
    lab.appendChild(input); lab.appendChild(dot);
    swHost.appendChild(lab);
  });
  function selectedColor() { var r = swHost.querySelector('input:checked'); return r ? r.value : 'gold'; }
  function updatePreview() {
    var c = BY_ID[selectedColor()];
    var p = $('previewLantern');
    p.innerHTML = lanternSVG(c.hex, true);
    p.firstChild.style.filter = 'drop-shadow(0 0 26px ' + c.hex + ')';
    $('previewName').textContent = c.name;
  }
  swHost.addEventListener('change', updatePreview);
  updatePreview();

  var wishText = $('wishText'), senderName = $('senderName');
  wishText.addEventListener('input', function () {
    $('wishCount').textContent = wishText.value.length + '/' + MAX_TEXT;
    if (wishText.value.trim()) { $('wishErr').textContent = ''; wishText.removeAttribute('aria-invalid'); }
  });

  $('openWish').addEventListener('click', function () {
    $('formErr').textContent = '';
    openDialog($('wishDialog'));
    setTimeout(function () { wishText.focus(); }, 30);
  });

  $('wishForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (state.sending) return;
    var text = wishText.value.trim().slice(0, MAX_TEXT);
    if (!text) {
      $('wishErr').textContent = 'Please write your wish before releasing the lantern.';
      wishText.setAttribute('aria-invalid', 'true');
      wishText.focus();
      return;
    }
    var wait = state.lastSent + COOLDOWN_MS - Date.now();
    if (wait > 0) { $('formErr').textContent = 'Your last lantern is still rising. Please wait ' + Math.ceil(wait / 1000) + ' seconds before sending another.'; return; }

    state.sending = true;
    $('releaseBtn').disabled = true;
    $('formErr').textContent = '';
    api('POST', '/api/wishes', { text: text, name: senderName.value.trim().slice(0, MAX_NAME), color: selectedColor() })
      .then(function (res) {
        var w = clean(res.wish.id, res.wish);
        state.mine[w.id] = res.deleteToken; saveMine();
        state.lastSent = Date.now();
        wishText.value = ''; $('wishCount').textContent = '0/' + MAX_TEXT;
        $('wishDialog').close();
        if (w && !state.wishes.some(function (x) { return x.id === w.id; })) {
          state.wishes.unshift(w);
          state.rising.add(w.id);
          state.total = (state.total || 0) + 1;
          state.lastCelebrated = w.id;
          updateCount(); renderLanterns();
          celebrate(BY_ID[w.color].hex);
        }
        toast('Your lantern is rising into the sky. Happy Thadingyut!');
      })
      .catch(function (err) {
        var s = err.status;
        $('formErr').textContent = s === 400 ? (err.data && err.data.error) || 'Please check your wish and try again.'
          : s === 429 ? 'Too many wishes at once. Please wait a minute and try again.'
          : s === 507 ? 'The sky is full right now, so no more wishes can be added. Please let the organizers know.'
          : 'Your wish couldn’t be sent. Check your connection and try again.';
      })
      .then(function () { state.sending = false; $('releaseBtn').disabled = false; });
  });

  // Read wish
  function canRemove(w) { return !!(state.adminKey || state.mine[w.id]); }
  function openRead(w) {
    if (!w) return;
    state.current = w;
    var c = BY_ID[w.color];
    var lan = $('readLantern');
    lan.innerHTML = lanternSVG(c.hex, true);
    lan.firstChild.style.filter = 'drop-shadow(0 0 16px ' + c.hex + ')';
    $('read-from').textContent = 'A wish from ' + (w.name || 'a friend');
    $('readText').textContent = '“' + w.text + '”';
    $('readWhen').textContent = w.createdAt ? timeAgo(w.createdAt) : '';
    $('modArea').hidden = !canRemove(w);
    $('removeBtn').textContent = state.mine[w.id] && !state.adminKey ? 'Remove my wish' : 'Remove wish';
    $('confirmArea').hidden = true;
    $('confirmArea').querySelector('p').textContent = 'Remove this wish for everyone?';
    if ($('listDialog').open) $('listDialog').close();
    openDialog($('readDialog'));
  }
  $('removeBtn').addEventListener('click', function () { $('modArea').hidden = true; $('confirmArea').hidden = false; $('cancelRemove').focus(); });
  $('cancelRemove').addEventListener('click', function () { $('confirmArea').hidden = true; $('modArea').hidden = false; });
  $('confirmRemove').addEventListener('click', function () {
    var w = state.current; if (!w) return;
    var headers = state.adminKey ? { 'X-Admin-Key': state.adminKey } : { 'X-Delete-Token': state.mine[w.id] || '' };
    $('confirmRemove').disabled = true;
    api('DELETE', '/api/wishes/' + encodeURIComponent(w.id), null, headers)
      .then(function () {
        delete state.mine[w.id]; saveMine();
        state.wishes = state.wishes.filter(function (x) { return x.id !== w.id; });
        if (state.total) state.total -= 1;
        updateCount(); renderLanterns();
        $('readDialog').close();
        toast('The wish was removed.');
      })
      .catch(function (err) {
        $('confirmArea').querySelector('p').textContent = err.status === 403
          ? 'You can’t remove this wish. Check your moderator key.'
          : 'The wish couldn’t be removed. Please try again.';
      })
      .then(function () { $('confirmRemove').disabled = false; });
  });

  // All wishes list
  function renderList() {
    var ul = $('wishList');
    ul.textContent = '';
    state.wishes.forEach(function (w) {
      var li = document.createElement('li'), b = document.createElement('button');
      b.type = 'button';
      var dot = document.createElement('span'); dot.className = 'dot'; dot.innerHTML = lanternSVG(BY_ID[w.color].hex, false);
      var body = document.createElement('span');
      var t = document.createElement('span'); t.className = 't'; t.textContent = w.text;
      var m = document.createElement('span'); m.className = 'm'; m.textContent = (w.name || 'A friend') + ' · ' + (w.createdAt ? timeAgo(w.createdAt) : '');
      body.appendChild(t); body.appendChild(m);
      b.appendChild(dot); b.appendChild(body);
      b.addEventListener('click', function () { openRead(w); });
      li.appendChild(b); ul.appendChild(li);
    });
    var n = state.total || state.wishes.length;
    $('listEmpty').hidden = state.wishes.length > 0;
    $('listSub').textContent = n ? (n > state.wishes.length ? 'Showing the latest ' + state.wishes.length + ' of ' + n + ' wishes' : n + (n === 1 ? ' wish' : ' wishes') + ', newest first') : '';
  }
  $('countBtn').addEventListener('click', function () { renderList(); openDialog($('listDialog')); });

  // Moderator mode: open the site with #admin in the address
  try { state.adminKey = sessionStorage.getItem('lantern-admin') || null; } catch (e) { /* ignore */ }
  function showAdminBadge() { $('adminBadge').hidden = !state.adminKey; }
  function maybeOpenAdmin() { if (location.hash === '#admin') { $('adminErr').textContent = ''; openDialog($('adminDialog')); } }
  $('adminForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var key = $('adminKey').value.trim();
    if (!key) { $('adminErr').textContent = 'Enter the moderator key.'; return; }
    api('POST', '/api/admin-check', null, { 'X-Admin-Key': key })
      .then(function () {
        state.adminKey = key;
        try { sessionStorage.setItem('lantern-admin', key); } catch (err) { /* ignore */ }
        $('adminKey').value = '';
        showAdminBadge();
        $('adminDialog').close();
        toast('Moderation is on. Open any lantern to remove it.');
      })
      .catch(function () { $('adminErr').textContent = 'That key didn’t work. Check it and try again.'; });
  });
  $('adminOff').addEventListener('click', function () {
    state.adminKey = null;
    try { sessionStorage.removeItem('lantern-admin'); } catch (err) { /* ignore */ }
    showAdminBadge();
    $('adminDialog').close();
  });
  window.addEventListener('hashchange', maybeOpenAdmin);
  showAdminBadge();
  maybeOpenAdmin();

  /* ---------- Data: poll for new wishes ---------- */
  var POLL_MS = 8000, pollTimer = null, firstLoad = true;
  function poll() {
    clearTimeout(pollTimer);
    if (document.hidden) { pollTimer = setTimeout(poll, POLL_MS); return; }
    var q = state.version != null ? '?v=' + encodeURIComponent(state.version) : '';
    api('GET', '/api/wishes' + q)
      .then(function (res) {
        if (!state.online) { state.online = true; setStatus(''); }
        if (res.unchanged) return;
        state.version = res.version;
        state.total = res.total;
        var list = (res.wishes || []).map(function (d) { return clean(d.id, d); }).filter(Boolean);
        if (!firstLoad) {
          var known = new Set(state.wishes.map(function (w) { return w.id; }));
          var fresh = null;
          list.forEach(function (w) {
            if (!known.has(w.id)) { state.rising.add(w.id); if (Date.now() - w.createdAt < 120000) fresh = fresh || w; }
          });
          if (fresh && fresh.id !== state.lastCelebrated) { state.lastCelebrated = fresh.id; celebrate(BY_ID[fresh.color].hex); }
        }
        firstLoad = false;
        state.loaded = true;
        state.wishes = list;
        updateCount();
        renderLanterns();
        if ($('listDialog').open) renderList();
      })
      .catch(function () {
        state.online = false;
        setStatus('Can’t reach the wish server. Retrying...');
      })
      .then(function () { pollTimer = setTimeout(poll, POLL_MS); });
  }
  document.addEventListener('visibilitychange', function () { if (!document.hidden) poll(); });
  poll();
})();
