/* HOMELODY Coffee & Brunch — landing page
 *
 *  1. Data      menu + shop info from Supabase (config.js); falls back to the last good copy, then menu-data.js
 *  2. Header    transparent over the hero, cream once scrolled; mobile menu
 *  3. Drinks    vertical product dissolve, a softly tinted frame, synchronized copy and pausable autoplay
 *  4. Details   modal on desktop, bottom sheet on mobile; Escape, focus trap, focus returns to the opener
 *  5. Page      menu tabs by category, shop info, scroll reveals
 *
 * Every animation uses the Web Animations API and is skipped under prefers-reduced-motion.
 */
(function () {
  'use strict';

  var CFG = window.HOMELODY_CONFIG || {};
  var FALLBACK = window.HOMELODY_FALLBACK || { drinks: [], shop: {} };
  var CACHE_KEY = 'homelody:menu:v1';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function still() { return reduceMotion.matches || typeof Element.prototype.animate !== 'function'; }

  /* ------------------------------------------------------------------ helpers */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function formatPrice(vnd) { return String(Math.round(vnd)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ'; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function str(v) { return typeof v === 'string' ? v.trim() : ''; }
  function imgSrc(d) { return d.image || ''; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function cancelAll(list) { list.forEach(function (a) { try { a.cancel(); } catch (e) { /* already gone */ } }); list.length = 0; }
  function done(anim) { return anim.finished.catch(function () {}); }

  /* Wait for an image (bounded), never reject. */
  function ready(img, ms) {
    return new Promise(function (resolve) {
      if (img.complete && img.naturalWidth) { resolve(); return; }
      var t = setTimeout(resolve, ms || 2500);
      function ok() { clearTimeout(t); resolve(); }
      img.addEventListener('load', ok, { once: true });
      img.addEventListener('error', ok, { once: true });
    });
  }

  document.addEventListener('error', function (e) {
    if (e.target instanceof HTMLImageElement) e.target.hidden = true;
  }, true);

  /* Nhóm món (config.js → menuCategories): tên chuẩn, tên tiếng Anh, tên cũ tương đương (aliases). */
  var CATEGORIES = (Array.isArray(CFG.menuCategories) ? CFG.menuCategories : []).map(function (c) {
    return { name: str(c && c.name), en: str(c && c.en), aliases: (c && Array.isArray(c.aliases) ? c.aliases : []).map(str) };
  }).filter(function (c) { return c.name; });
  function catKey(v) { return str(v).toLowerCase().replace(/\s+/g, ' '); }
  function canonicalCategory(v) {
    var k = catKey(v);
    for (var i = 0; i < CATEGORIES.length; i++) {
      var c = CATEGORIES[i];
      if (catKey(c.name) === k || c.aliases.some(function (a) { return catKey(a) === k; })) return c.name;
    }
    return str(v);
  }
  function categoryLabel(name) {
    var c = CATEGORIES.filter(function (x) { return x.name === name; })[0];
    return c && c.en ? c.name + ' · ' + c.en : name;
  }

  /* ================================================================== 1. DATA */
  function isConfigured() {
    return /^https:\/\/[^\s]+$/.test(str(CFG.supabaseUrl)) && str(CFG.supabaseKey).length > 20;
  }
  function restHeaders() {
    var key = str(CFG.supabaseKey), h = { apikey: key, Accept: 'application/json' };
    if (key.indexOf('eyJ') === 0) h.Authorization = 'Bearer ' + key;   // legacy anon (JWT) key
    return h;                                                         // publishable keys go on apikey only
  }
  function getJson(url, ms) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, ms);
    return fetch(url, { headers: restHeaders(), signal: ctrl && ctrl.signal, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .finally(function () { clearTimeout(timer); });
  }
  function normDrink(r) {
    var ing = r.ingredients;
    if (typeof ing === 'string') ing = ing.split(/[,;\n]/);
    var override = (CFG.productDisplayOverrides || {})[str(r.name).toLocaleLowerCase('vi')] || {};
    r = Object.assign({}, r, override);
    return {
      id: r.id,
      name: str(r.name).replace(/^./u, function (c) { return c.toLocaleUpperCase('vi'); }),
      category: canonicalCategory(str(r.category)) || 'Thức uống',
      price: Number(r.price) || 0,
      description: str(r.description),
      note: str(r.note),
      ingredients: (Array.isArray(ing) ? ing : []).map(str).filter(Boolean),
      image: str(r.image_url) || str(r.image),
      stageTone: str(r.stageTone),
      alt: str(r.image_alt) || str(r.alt) || ('Ly ' + str(r.name)),
      featured: !!(r.is_featured || r.featured)
    };
  }
  function normShopRow(r) {
    return {
      address: str(r.address), hours: str(r.hours), phone: str(r.phone),
      directionsUrl: str(r.directions_url), contactUrl: str(r.contact_url),
      social: { Instagram: str(r.instagram_url), Facebook: str(r.facebook_url), TikTok: str(r.tiktok_url) }
    };
  }
  function demoData() {
    // Preview mode: if the menu was edited in /admin without Supabase, that copy lives in this browser.
    try {
      var local = JSON.parse(localStorage.getItem('homelody:admin-demo') || 'null');
      if (local && Array.isArray(local.drinks)) {
        return {
          drinks: local.drinks.slice().sort(function (a, b) { return (a.sort_order || 0) - (b.sort_order || 0); })
            .filter(function (r) { return r.is_active !== false; }).map(normDrink),
          shop: local.shop ? normShopRow(local.shop) : (FALLBACK.shop || {}),
          source: 'demo'
        };
      }
    } catch (e) { /* ignore */ }
    return { drinks: (FALLBACK.drinks || []).map(normDrink), shop: FALLBACK.shop || {}, source: 'demo' };
  }
  function loadData() {
    if (!isConfigured()) return Promise.resolve(demoData());
    var base = str(CFG.supabaseUrl).replace(/\/+$/, '') + '/rest/v1/';
    return Promise.all([
      getJson(base + 'drinks?select=*&is_active=eq.true&order=sort_order.asc,created_at.asc', 6000),
      getJson(base + 'shop_settings?select=*&id=eq.1', 6000)
    ]).then(function (res) {
      var data = { drinks: res[0].map(normDrink), shop: res[1][0] ? normShopRow(res[1][0]) : {}, source: 'live' };
      try { localStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), drinks: data.drinks, shop: data.shop })); } catch (e) { /* storage off */ }
      return data;
    }).catch(function (err) {
      console.warn('[Homelody] Không tải được menu từ Supabase, dùng dữ liệu dự phòng.', err);
      try {
        var c = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
        if (c && c.drinks && c.drinks.length) return { drinks: c.drinks.map(normDrink), shop: c.shop || {}, source: 'cache' };
      } catch (e) { /* ignore */ }
      return demoData();
    });
  }

  /* ================================================================== 2. HEADER */
  (function setupHeader() {
    var header = $('[data-header]');
    var heroEl = $('.hero');
    var toggle = $('[data-nav-toggle]');
    var nav = $('[data-nav]');
    if (!header) return;

    var raf = 0;
    function update() {
      raf = 0;
      var over = window.scrollY <= 80;
      header.classList.toggle('is-over-hero', over);
    }
    window.addEventListener('scroll', function () { if (!raf) raf = requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', function () { if (!raf) raf = requestAnimationFrame(update); });
    update();

    if (!toggle || !nav) return;
    var label = $('.sr-only', toggle);
    function setOpen(open) {
      header.classList.toggle('is-open', open);
      document.documentElement.classList.toggle('is-nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (label) label.textContent = open ? 'Đóng menu' : 'Mở menu';
    }
    toggle.addEventListener('click', function () { setOpen(!header.classList.contains('is-open')); });
    $$('a', nav).forEach(function (a) { a.addEventListener('click', function () { setOpen(false); }); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    document.addEventListener('click', function (e) {
      if (header.classList.contains('is-open') && !header.contains(e.target)) setOpen(false);
    });
    window.matchMedia('(min-width: 960px)').addEventListener('change', function (m) { if (m.matches) setOpen(false); });
  })();

  (function setupBakeryParallax() {
    var section = $('#banh-nha-lam'), image = section && $('.bakery__media img', section);
    if (!image || !('IntersectionObserver' in window)) return;
    var desktop = window.matchMedia('(min-width: 768px)'), visible = false, frame = 0;
    var current = { y: 0, angle: 0, copy: 0, open: 0 }, target = { y: 0, angle: 0, copy: 0, open: 0 }, lastTime = 0;
    if (!still()) section.classList.add('is-bakery-scroll');
    function enabled() { return !still() && !document.hidden; }
    function reset() {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      ['--bakery-y', '--bakery-angle', '--bakery-copy-y', '--bakery-page-inset', '--bakery-page-radius', '--bakery-page-lift'].forEach(function (key) { section.style.removeProperty(key); });
      section.classList.remove('is-bakery-scroll');
      current = { y: 0, angle: 0, copy: 0, open: 0 };
    }
    function tick(now) {
      frame = 0;
      if (!enabled()) { reset(); return; }
      if (!visible) { lastTime = 0; return; }
      var dt = lastTime ? Math.min(now - lastTime, 64) : 16.67;
      lastTime = now;
      var ease = 1 - Math.exp(-dt / 140), moving = false;
      Object.keys(current).forEach(function (key) {
        current[key] += (target[key] - current[key]) * ease;
        if (Math.abs(target[key] - current[key]) > .02) moving = true;
        else current[key] = target[key];
      });
      section.style.setProperty('--bakery-y', current.y.toFixed(2) + 'px');
      section.style.setProperty('--bakery-angle', current.angle.toFixed(2) + 'deg');
      section.style.setProperty('--bakery-copy-y', current.copy.toFixed(2) + 'px');
      var remaining = 1 - current.open;
      section.style.setProperty('--bakery-page-inset', (remaining * (desktop.matches ? Math.min(innerWidth * .045, 80) : 12)).toFixed(2) + 'px');
      section.style.setProperty('--bakery-page-radius', (remaining * (desktop.matches ? 56 : 24)).toFixed(2) + 'px');
      section.style.setProperty('--bakery-page-lift', (remaining * (desktop.matches ? 40 : 16)).toFixed(2) + 'px');
      if (moving) frame = requestAnimationFrame(tick);
      else lastTime = 0;
    }
    function request() {
      if (!enabled()) { reset(); return; }
      if (!visible) return;
      section.classList.add('is-bakery-scroll');
      var rect = section.getBoundingClientRect();
      var progress = clamp((innerHeight - rect.top) / (innerHeight + rect.height), 0, 1);
      target.y = desktop.matches ? 60 - progress * 120 : 0;
      target.angle = desktop.matches ? -8 + progress * 14 : 0;
      target.copy = desktop.matches ? -12 + progress * 24 : 0;
      target.open = clamp((innerHeight - rect.top) / (innerHeight * .7), 0, 1);
      if (!frame) frame = requestAnimationFrame(tick);
    }
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; request(); }).observe(section);
    window.addEventListener('scroll', function () { if (visible) request(); }, { passive: true });
    window.addEventListener('resize', request);
    document.addEventListener('visibilitychange', request);
    reduceMotion.addEventListener('change', request);
  })();

  /* Story: heading, photographs and signature enter once; paragraph words follow scroll separately. */
  (function setupStory() {
    var story = $('#cau-chuyen'), stack = $('[data-story-stack]');
    if (!story || !stack) return;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        stack.classList.toggle('is-visible', entries[0].isIntersecting);
      }).observe(stack);
    } else stack.classList.add('is-visible');
    document.addEventListener('visibilitychange', function () { stack.classList.toggle('is-page-hidden', document.hidden); });
    if (still() || !('IntersectionObserver' in window)) return;
    var intro = $$('.story__inner > .eyebrow, .story__title', story);
    var targets = intro.concat([stack], $$('[data-story-sign]', story));
    targets.forEach(function (el, k) {
      el.setAttribute('data-story-reveal', '');
      el.style.setProperty('--story-reveal-delay', (k === 1 ? 80 : 0) + 'ms');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-story-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    function finish() {
      story.classList.remove('is-story-ready');
      targets.forEach(function (el) { el.classList.add('is-story-in'); });
      observer.disconnect();
    }
    story.classList.add('is-story-ready');
    targets.forEach(function (el) { observer.observe(el); });
    story.addEventListener('focusin', finish);
    reduceMotion.addEventListener('change', function () { if (still()) finish(); });
  })();

  /* ================================================================== 3. DRINKS (khung trưng bày sản phẩm)
     Nền kem, không bàn. Mỗi sản phẩm được căn giữa theo vùng ảnh THỰC SỰ nhìn thấy (bỏ qua viền trong suốt của PNG)
     và có kích thước riêng theo "độ nặng thị giác": diện tích nhìn thấy gần bằng nhau giữa các món, nên ly cao và
     tách có đĩa không bị ép cùng chiều cao. Món dáng ngang (rộng hơn cao, vd. bộ trà gừng) nhỏ thêm 15% để chừa khoảng thở. */
  var section = $('.drinks');
  var stageEl = $('[data-stage]');
  var stageBtn = $('[data-drink-stage]');
  var info = $('[data-drink-info]');
  var optionsRoot = $('[data-drink-options]');
  var selectorRoot = $('[data-drink-selector]'), nextDrink = $('[data-drink-next]');
  var selectorStart = 0, requestedPageStart = null;
  var live = $('[data-live]');
  var field = {};
  $$('[data-field]', section).forEach(function (el) { field[el.getAttribute('data-field')] = el; });

  var DRINKS = [], FEATURED = [], SOURCE = 'demo';
  var current = 0, requested = 0; // current = dữ liệu đã commit; requested = ý định mới nhất đang chờ ảnh.
  var options = [];
  var pill = null, pillBox = null;
  var swapToken = 0, swapAnims = [];
  var textToken = 0, textAnims = [];

  /* Bố cục trong khung (theo tỷ lệ bề rộng W / chiều cao H của khung):
     tâm thị giác (cx, cy); "độ nặng" = √(rộng × cao) nhìn thấy = MASS × W; giới hạn cao MAX_H × H, rộng MAX_W × W. */
  var SHOW = { cx: 0.5, cy: 0.52, MASS: 0.4, MAX_H: 0.74, MAX_W: 0.56, WIDE: 0.85 };
  /* Start a new product every 2 seconds, including its exit/entry transition. */
  var OUT_MS = 320, IN_MS = 620, SHIFT = 20, AUTOPLAY_MS = 2000;
  var DRINK_EASE = 'cubic-bezier(.22,1,.36,1)', EXIT_EASE = 'cubic-bezier(.4,0,.2,1)';
  var autoplayTimer = 0, stageVisible = false;
  var playbackReady = false, transitioning = false;

  function setStageTone(d) {
    var key = (d.name + ' ' + d.category).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    var tone = '#EDE4D6';
    if (/matcha/.test(key)) tone = '#DCE5C7';
    else if (/bac xiu/.test(key)) tone = '#EBD9BF';
    else if (/cam|chanh|xoai|dua/.test(key)) tone = '#F0D7AE';
    else if (/ca phe sua|latte|cappuccino/.test(key)) tone = '#DEC09E';
    else if (/cacao|chocolate/.test(key)) tone = '#D9BDA6';
    else if (/ca phe|coffee|espresso|cold brew/.test(key)) tone = '#D3CEB7';
    else if (/tra|tea/.test(key)) tone = '#E2DFC7';
    if (/^#[0-9a-f]{6}$/i.test(d.stageTone)) tone = d.stageTone;
    stageEl.style.setProperty('--drink-tone', tone);
  }
  function stopAutoplay() { clearTimeout(autoplayTimer); autoplayTimer = 0; }
  function canAutoplay() {
    return playbackReady && stageVisible && !document.hidden && !still() &&
      dialogState === 'idle' && FEATURED.length > 1;
  }
  function queueAutoplay(delayMs) {
    stopAutoplay();
    if (!canAutoplay() || transitioning) return;
    autoplayTimer = setTimeout(function () {
      autoplayTimer = 0;
      if (canAutoplay()) select((current + 1) % FEATURED.length, true);
    }, typeof delayMs === 'number' ? Math.max(250, delayMs) : AUTOPLAY_MS);
  }

  var boxCache = {};
  /* Vùng nhìn thấy của ảnh: bỏ viền gần như trong suốt (alpha ≤ 40). Ảnh khác nguồn không cho đọc điểm ảnh → dùng cả ảnh. */
  function visibleBox(img) {
    var key = img.currentSrc || img.src, nw = img.naturalWidth, nh = img.naturalHeight;
    var full = { x: 0, y: 0, w: nw, h: nh };
    if (!nw || !nh) return full;
    if (boxCache[key]) return boxCache[key];
    try {
      var k = Math.min(1, 240 / Math.max(nw, nh)), cw = Math.max(1, Math.round(nw * k)), ch = Math.max(1, Math.round(nh * k));
      var c = document.createElement('canvas'); c.width = cw; c.height = ch;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, cw, ch);
      var px = ctx.getImageData(0, 0, cw, ch).data, minX = cw, minY = ch, maxX = -1, maxY = -1;
      for (var y = 0; y < ch; y++) for (var x = 0; x < cw; x++) {
        if (px[(y * cw + x) * 4 + 3] > 40) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
      boxCache[key] = maxX < 0 ? full : { x: minX / k, y: minY / k, w: (maxX - minX + 1) / k, h: (maxY - minY + 1) / k };
    } catch (e) { boxCache[key] = full; }
    return boxCache[key];
  }
  /* Đặt ảnh + bóng mềm theo vùng nhìn thấy; tính lại khi đổi kích thước khung. */
  function layoutGlass(g) {
    var img = $('.glass__img', g), shadow = $('.glass__shadow', g);
    if (!img || !img.naturalWidth) return;
    var W = stageEl.clientWidth, H = stageEl.clientHeight;
    if (!W || !H) return;
    var b = visibleBox(img), aspect = b.w / b.h;
    var vh = (SHOW.MASS * W) / Math.sqrt(aspect);                      // cùng "độ nặng" thị giác
    if (aspect > 1) vh *= SHOW.WIDE;                                     // món dáng ngang nhỏ thêm một chút
    vh = Math.min(vh, SHOW.MAX_H * H, (SHOW.MAX_W * W) / aspect);
    var s = vh / b.h, vw = b.w * s, cx = SHOW.cx * W, cy = SHOW.cy * H;
    img.style.transform = 'none';
    img.style.width = (img.naturalWidth * s).toFixed(1) + 'px';
    img.style.height = (img.naturalHeight * s).toFixed(1) + 'px';
    img.style.left = (cx - (b.x + b.w / 2) * s).toFixed(1) + 'px';
    img.style.top = (cy - (b.y + b.h / 2) * s).toFixed(1) + 'px';
    if (shadow) {                                                        // bóng rất nhẹ sát đáy sản phẩm
      var sw = vw * 0.78, sh = Math.max(8, vw * 0.07);
      shadow.style.width = sw.toFixed(1) + 'px';
      shadow.style.height = sh.toFixed(1) + 'px';
      shadow.style.left = (cx - sw / 2).toFixed(1) + 'px';
      shadow.style.top = (cy + vh / 2 - sh * 0.55).toFixed(1) + 'px';
    }
    g.setAttribute('data-laid', '');
  }

  function currentGlass() {
    var all = $$('.glass', stageBtn);
    return $('.glass.is-current', stageBtn) || all[all.length - 1];
  }
  function makeGlass(d) {
    var g = document.createElement('span');
    g.className = 'glass';
    g.innerHTML = '<span class="glass__shadow" aria-hidden="true"></span>';
    var img = new Image();
    img.className = 'glass__img';
    img.alt = d.alt;
    img.decoding = 'async'; img.draggable = false;
    var src = imgSrc(d);
    if (/^https?:\/\//i.test(src) && src.indexOf(location.origin) !== 0) img.crossOrigin = 'anonymous';   // để đọc được vùng nhìn thấy (Supabase cho phép CORS)
    img.src = src;
    g.appendChild(img);
    return g;
  }

  /* Đưa khung về trạng thái nghỉ trước lượt đổi mới; trả về trạng thái đang hiển thị của sản phẩm hiện tại (nếu đang chuyển). */
  function settleStage() {
    var moving = $$('.glass', stageBtn);
    var keep = $('.glass.is-current', stageBtn) || moving[moving.length - 1];
    var running = swapAnims.some(function (a) { return a.effect && a.effect.target === keep && a.playState === 'running'; });
    var snapshot = null;
    if (running || keep.style.opacity) { // tiếp tục từ chỗ đang dừng, kể cả khi request mới còn tải ảnh
      var cs = getComputedStyle(keep);
      snapshot = { transform: cs.transform === 'none' ? 'translateY(0px) scale(1)' : cs.transform, opacity: cs.opacity };
    }
    cancelAll(swapAnims);
    if (snapshot) { keep.style.transform = snapshot.transform; keep.style.opacity = snapshot.opacity; }
    moving.forEach(function (g) { if (g !== keep) g.remove(); });
    return snapshot;
  }

  function select(i, automatic, focusAfter, pageStart) {
    if (!FEATURED[i]) return;
    if (i === current && !transitioning) {
      if (typeof pageStart === 'number') { selectorStart = pageStart; renderOptions(); movePill(true); }
      return;
    }
    if (i === requested && transitioning && pageStart === requestedPageStart) return;
    stopAutoplay();
    transitioning = true;
    var selectionStarted = performance.now();
    requested = i;
    requestedPageStart = typeof pageStart === 'number' ? pageStart : null;
    var d = FEATURED[i], token = ++swapToken;
    var snapshot = settleStage();
    var outgoing = currentGlass();
    // Giữ khung hình hiện tại trong lúc giải mã ảnh mới; không đổi active/text sớm.
    var textOpacity = getComputedStyle(field.name).opacity;
    ++textToken; cancelAll(textAnims);
    infoParts().forEach(function (el) { el.style.opacity = textOpacity; });
    var incoming = makeGlass(d);
    var img = incoming.querySelector('img');
    stageEl.setAttribute('aria-busy', 'true');

    ready(img, 1500).then(function () {
      if (img.complete && img.naturalWidth && img.decode) return img.decode().catch(function () {});
    }).then(function () {
      if (token !== swapToken) return;          // một lựa chọn mới hơn đã thắng; nó sẽ tự đổi
      // Ảnh tải chậm vẫn giữ nguyên món cũ; không đặt một <img> chưa sẵn sàng vào sân khấu.
      if (!img.complete || !img.naturalWidth) { finishSelection(); queueAutoplay(); return; }
      if (still()) { commit(); complete(); return; }
      stageEl.classList.add('is-swapping');
      var from = snapshot || { transform: 'translateY(0px) scale(1)', opacity: 1 };
      var exitMs = Math.max(100, Math.round(OUT_MS * Number(from.opacity)));
      var aOut = outgoing.animate([from, { transform: 'translateY(' + -SHIFT + 'px) scale(.97)', opacity: 0 }],
        { duration: exitMs, easing: EXIT_EASE, fill: 'forwards' });
      swapAnims.push(aOut);
      infoParts().forEach(function (el) {
        textAnims.push(el.animate([{ opacity: textOpacity }, { opacity: 0 }],
          { duration: Math.min(160, exitMs), easing: EXIT_EASE, fill: 'forwards' }));
      });
      done(aOut).then(function () {
        if (token !== swapToken) return;
        cancelAll(swapAnims);
        commit();
        var aIn = incoming.animate([{ transform: 'translateY(' + SHIFT + 'px) scale(.94)', opacity: 0 }, { transform: 'translateY(0px) scale(1)', opacity: 1 }],
          { duration: IN_MS, easing: DRINK_EASE, fill: 'backwards' });
        var shadow = $('.glass__shadow', incoming);
        swapAnims.push(aIn, shadow.animate([{ opacity: .5, scale: '.96' }, { opacity: 1, scale: '1' }],
          { duration: IN_MS, easing: DRINK_EASE, fill: 'backwards' }));
        swapText(d);
        done(aIn).then(complete);
      });
    });

    function commit() {
      current = i;
      incoming.classList.add('is-current');
      stageBtn.replaceChildren(incoming);
      layoutGlass(incoming);
      setTextNow(d); setStageTone(d);
      if (typeof pageStart === 'number') selectorStart = pageStart;
      renderOptions(); movePill();
      if (!automatic) live.textContent = d.name + ', ' + formatPrice(d.price);
      if (dialogState === 'idle') fillDialog(d);
      if (focusAfter) options[i].focus({ preventScroll: true });
    }
    function complete() {
      if (token !== swapToken) return;
      cancelAll(swapAnims);
      stageEl.classList.remove('is-swapping'); stageEl.setAttribute('aria-busy', 'false');
      transitioning = false;
      requestedPageStart = null;
      queueAutoplay(AUTOPLAY_MS - (performance.now() - selectionStarted));
    }
  }

  /* Text nhận dữ liệu ở cùng frame commit ảnh/thumbnail, sau đó fade vào 320ms. */
  function fillField(el, d) {
    var k = el.getAttribute('data-field');
    if (k === 'name') el.textContent = d.name;
    else if (k === 'description') el.textContent = d.description;
    else if (k === 'note') el.textContent = d.note;
    else if (k === 'price') el.textContent = formatPrice(d.price);
    else if (k === 'index') el.textContent = pad(FEATURED.indexOf(d) + 1);
  }
  function infoParts() { return [field.index, field.name, field.description, field.note, field.price]; }
  function swapText(d) {
    if (still()) return;
    infoParts().forEach(function (el) {
      textAnims.push(el.animate([{ opacity: 0, transform: 'translateY(3px)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, easing: DRINK_EASE, fill: 'backwards' }));
    });
  }
  function setTextNow(d) {
    textToken++;
    cancelAll(textAnims);
    infoParts().forEach(function (el) { el.style.opacity = ''; fillField(el, d); });
  }

  // Popup, reduced motion và pagehide dùng món đã commit; hủy mọi request/animation cũ.
  function finishSelection() {
    stopAutoplay(); ++swapToken;
    cancelAll(swapAnims);
    requested = current; requestedPageStart = null; transitioning = false;
    var g = currentGlass();
    if (g) { stageBtn.replaceChildren(g); g.style.transform = ''; g.style.opacity = ''; }
    stageEl.classList.remove('is-swapping'); stageEl.setAttribute('aria-busy', 'false');
    if (FEATURED[current]) { setTextNow(FEATURED[current]); setStageTone(FEATURED[current]); renderOptions(); movePill(true); }
  }

  /* No layout shift: the text block (tên + mô tả + hương vị) keeps the height of its tallest drink at the current width,
     so the price and the "Xem chi tiết" button never move. */
  function lockInfoHeight() {
    var block = info && $('[data-drink-text]', info);
    if (!block || !FEATURED.length) return;
    block.style.minHeight = '';
    var probe = block.cloneNode(true);
    probe.removeAttribute('data-drink-text');
    probe.setAttribute('aria-hidden', 'true');
    probe.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;margin:0;width:' + block.getBoundingClientRect().width + 'px';
    document.body.appendChild(probe);
    var pf = {};
    $$('[data-field]', probe).forEach(function (el) { pf[el.getAttribute('data-field')] = el; });
    var max = 0;
    FEATURED.forEach(function (d) {
      fillField(pf.name, d); fillField(pf.description, d); fillField(pf.note, d);
      max = Math.max(max, probe.getBoundingClientRect().height);
    });
    probe.remove();
    block.style.minHeight = Math.ceil(max) + 'px';
    // giá rộng nhất → nút "Xem chi tiết" bên cạnh không xê dịch khi giá đổi (vd. 45.000đ ↔ 55.000đ)
    var pp = field.price.cloneNode(true);
    pp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;min-width:0;width:auto';
    document.body.appendChild(pp);
    var pw = 0;
    FEATURED.forEach(function (d) { pp.textContent = formatPrice(d.price); pw = Math.max(pw, pp.getBoundingClientRect().width); });
    pp.remove();
    field.price.style.minWidth = Math.ceil(pw) + 'px';
  }

  /* ---------- Selector + sliding indicator */
  function renderSelector() {
    optionsRoot.innerHTML = FEATURED.map(function (d, i) {
      return '<button class="option" type="button" role="radio" aria-checked="false" tabindex="-1" data-drink="' + i + '">' +
        '<span class="option__thumb"><img src="' + esc(imgSrc(d)) + '" alt="" width="400" height="780" decoding="async"></span>' +
        '<span class="option__text"><span class="option__name" title="' + esc(d.name) + '">' + esc(d.name) + '</span>' +
        '<span class="option__price">' + formatPrice(d.price) + '</span></span></button>';
    }).join('');
    pill = null; pillBox = null;
    options = $$('[data-drink]', optionsRoot);
    options.forEach(function (btn, i) { btn.addEventListener('click', function () { select(i); }); });
    optionsRoot.hidden = FEATURED.length < 2;
    selectorRoot.hidden = FEATURED.length < 2;
    nextDrink.hidden = FEATURED.length <= 3;
    optionsRoot.style.setProperty('--selector-count', Math.min(3, FEATURED.length));
    field.total.textContent = pad(FEATURED.length);
  }
  function renderOptions() {
    if (current < selectorStart || current >= selectorStart + 3) {
      selectorStart = Math.min(Math.floor(current / 3) * 3, Math.max(0, FEATURED.length - 3));
    }
    options.forEach(function (btn, i) {
      btn.hidden = i < selectorStart || i >= selectorStart + 3;
      var on = i === current;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-checked', on ? 'true' : 'false');
      btn.tabIndex = on ? 0 : -1;
    });
  }
  function movePill(instant) {
    var btn = options[current];
    if (!btn) return;
    if (!pill) {
      pill = document.createElement('span');
      pill.className = 'selector__pill';
      pill.setAttribute('aria-hidden', 'true');
      optionsRoot.prepend(pill);
      optionsRoot.classList.add('has-pill');
    }
    var box = { x: btn.offsetLeft, y: btn.offsetTop, w: btn.offsetWidth, h: btn.offsetHeight };
    var to = { transform: 'translate(' + box.x + 'px,' + box.y + 'px)', width: box.w + 'px', height: box.h + 'px' };
    pill.getAnimations().forEach(function (a) { a.cancel(); });
    if (!instant && !still() && pillBox) {
      var from = { transform: 'translate(' + pillBox.x + 'px,' + pillBox.y + 'px) scale(' + (pillBox.w / box.w) + ',' + (pillBox.h / box.h) + ')' };
      pill.animate([from, { transform: to.transform }], { duration: 320, easing: DRINK_EASE });
    }
    pill.style.transform = to.transform; pill.style.width = to.width; pill.style.height = to.height;
    pillBox = box;
  }
  nextDrink.addEventListener('click', function () {
    if (FEATURED.length <= 3) return;
    var start = requestedPageStart === null ? selectorStart : requestedPageStart;
    var next = start + 3 >= FEATURED.length ? 0 : Math.min(start + 3, FEATURED.length - 3);
    select(next, false, false, next);
  });
  optionsRoot.addEventListener('keydown', function (e) {
    var n = FEATURED.length;
    var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key], target;
    if (step !== undefined) target = (requested + step + n) % n;
    else if (e.key === 'Home') { target = 0; step = -1; }
    else if (e.key === 'End') { target = n - 1; step = 1; }
    else return;
    e.preventDefault();
    if (target === current && !transitioning) options[target].focus({ preventScroll: true });
    else select(target, false, true);
  });
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () { movePill(true); lockInfoHeight(); $$('.glass', stageBtn).forEach(layoutGlass); }, 120);
  });
  // Keep the selection frame aligned after fonts load or the selector changes width.
  if ('ResizeObserver' in window) {
    new ResizeObserver(function () { if (pill) movePill(true); }).observe(optionsRoot);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (pill) movePill(true); });

  /* Tự chạy chỉ khi section hiện trong màn hình; ưu tiên mọi tương tác của khách. */
  function armIntro() {
    playbackReady = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        stageVisible = entries[0].isIntersecting && entries[0].intersectionRatio >= .45;
        queueAutoplay();
      }, { threshold: [0, .45] }).observe(stageEl);
    }
    document.addEventListener('visibilitychange', queueAutoplay);
    window.addEventListener('pagehide', function () { finishSelection(); clearTimeout(resizeTimer); });
    window.addEventListener('pageshow', queueAutoplay);
    dialog.addEventListener('close', queueAutoplay);
    new MutationObserver(queueAutoplay).observe(dialog, { attributes: true, attributeFilter: ['open'] });
    reduceMotion.addEventListener('change', function () {
      if (still()) finishSelection();
      queueAutoplay();
    });
  }

  /* ================================================================== 4. DETAILS (modal / bottom sheet) */
  var dialog = $('#drink-dialog');
  var panel = $('.drink-dialog__panel', dialog);
  var closeBtn = $('[data-close-dialog]', dialog);
  var dfield = {};
  $$('[data-dialog-field]', dialog).forEach(function (el) { dfield[el.getAttribute('data-dialog-field')] = el; });
  var sheetQuery = window.matchMedia('(max-width: 767px)');

  var dialogState = 'idle';          // idle → opening → open → closing → idle
  var dAnims = [], dToken = 0, opener = null, dialogMode = 'feature';

  var savedScroll = 0, savedBodyStyle = null;

  function fillDialog(d) {
    var fi = FEATURED.indexOf(d);
    if (d.image) { dfield.image.src = imgSrc(d); dfield.image.hidden = false; }
    else { dfield.image.removeAttribute('src'); dfield.image.hidden = true; }
    dfield.image.alt = d.alt;
    dfield.label.textContent = fi > -1 ? pad(fi + 1) + ' / ' + pad(FEATURED.length) + ' · Món được yêu thích' : categoryLabel(d.category);
    dfield.name.textContent = d.name;
    dfield.description.textContent = d.description;
    dfield.note.textContent = d.note;
    dfield.note.hidden = !d.note;
    dfield.price.textContent = formatPrice(d.price);
    dfield.ingredients.innerHTML = d.ingredients.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
    dfield.ingredients.hidden = !d.ingredients.length;
    $('.drink-dialog__subtitle', dialog).hidden = !d.ingredients.length;
    dialog.classList.toggle('is-text-only', !d.image);     // chưa có ảnh: bảng chỉ có chữ, không dùng ảnh placeholder
  }

  function lockScroll() {
    savedScroll = window.scrollY;
    savedBodyStyle = document.body.getAttribute('style');
    document.body.style.position = 'fixed';
    document.body.style.top = -savedScroll + 'px';
    document.body.style.width = '100%';
    document.documentElement.classList.add('is-locked');
  }
  function unlockScroll() {
    document.documentElement.classList.remove('is-locked');
    if (savedBodyStyle === null) document.body.removeAttribute('style');
    else document.body.setAttribute('style', savedBodyStyle);
    window.scrollTo({ top: savedScroll, behavior: 'instant' });
  }

  /* mode 'feature': mở từ phần đồ uống → nút "Xem thực đơn"; mode 'menu': mở từ thực đơn → nút "Đóng chi tiết" */
  function openDetails(d, from, mode) {
    if (dialogState !== 'idle' || !d) return;
    finishSelection(); // Dừng cả khi popup được mở từ thực đơn.
    stageEl.classList.add('is-obscured');
    dialogState = 'opening';
    var tk = ++dToken;
    opener = from || document.activeElement;
    dialogMode = mode === 'menu' ? 'menu' : 'feature';
    fillDialog(d);
    lockScroll();
    panel.scrollTop = 0;
    panel.style.transform = '';
    dialog.showModal();
    closeBtn.focus({ preventScroll: true });
    requestAnimationFrame(function () { if (dialogState !== 'idle') dialog.classList.add('is-open'); });
    if (still()) { dialogState = 'open'; return; }

    var a = sheetQuery.matches
      ? panel.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }], { duration: 380, easing: 'cubic-bezier(.16,1,.3,1)' })
      : panel.animate([{ opacity: 0, transform: 'translateY(12px) scale(.97)' }, { opacity: 1, transform: 'none' }], { duration: 360, easing: DRINK_EASE });
    dAnims.push(a);
    dAnims.push(dfield.image.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
      { duration: 420, delay: 80, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' }));
    done(a).then(function () { if (tk === dToken && dialogState === 'opening') { dialogState = 'open'; } });
  }

  function closeDetails(opts) {
    opts = opts || {};
    if (dialogState === 'idle' || dialogState === 'closing') return;
    cancelAll(dAnims);
    dialogState = 'closing';
    var tk = ++dToken;
    dialog.classList.remove('is-open');
    var finish = function () { if (tk === dToken) endClose(opts); };
    if (still()) { finish(); return; }
    var a;
    if (sheetQuery.matches) {
      var fromY = panel.style.transform || 'translateY(0)';
      a = panel.animate([{ transform: fromY }, { transform: 'translateY(105%)' }], { duration: opts.drag ? 220 : 280, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    } else {
      a = panel.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(10px) scale(.985)' }], { duration: 200, easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    }
    dAnims.push(a);
    done(a).then(finish);
  }
  function endClose(opts) {
    cancelAll(dAnims);
    panel.style.transform = '';
    dialog.classList.remove('is-open');
    if (dialog.open) dialog.close();
    unlockScroll();
    dialogState = 'idle';
    stageEl.classList.remove('is-obscured');
    var back = opener; opener = null;
    if (opts.after) opts.after();
    else if (back && back.isConnected) back.focus({ preventScroll: true });
  }

  function openCurrent(e) {
    var d = FEATURED[current];
    if (!d) return;
    // Popup dùng đúng món đang được trưng bày, không dùng request chưa commit.
    openDetails(d, e && e.currentTarget, 'feature');
  }
  $$('[data-open-drink]').forEach(function (btn) { btn.addEventListener('click', openCurrent); });
  closeBtn.addEventListener('click', function () { closeDetails(); });
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); closeDetails(); });     // Escape
  dialog.addEventListener('click', function (e) { if (e.target === dialog && dialogState === 'open') closeDetails(); });
  dialog.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', dialog).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  /* Bottom sheet: kéo thanh trên cùng xuống để đóng */
  (function sheetDrag() {
    var handle = $('.drink-dialog__handle', dialog);
    var dragY = null, startY = 0, startT = 0;
    handle.addEventListener('pointerdown', function (e) {
      if (dialogState !== 'open') return;
      dragY = 0; startY = e.clientY; startT = e.timeStamp;
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', function (e) {
      if (dragY === null) return;
      dragY = Math.max(0, e.clientY - startY);
      panel.style.transform = 'translateY(' + dragY + 'px)';
    });
    function back() {
      var from = panel.style.transform;
      panel.style.transform = '';
      if (from && !still()) panel.animate([{ transform: from }, { transform: 'translateY(0)' }], { duration: 300, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    handle.addEventListener('pointerup', function (e) {
      if (dragY === null) return;
      var v = dragY / Math.max(1, e.timeStamp - startT);
      if (dragY > 110 || v > 0.6) closeDetails({ drag: true }); else back();
      dragY = null;
    });
    handle.addEventListener('pointercancel', function () { if (dragY !== null) { dragY = null; back(); } });
  })();

  /* ================================================================== 5. PAGE */
  var menuTab = 0, menuTabs = null, menuToken = 0, menuAnims = [];
  var finishMenuReveal = null;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var menuCarouselCleanup = [];

  function bindMenuCarousels(root) {
    $$('[data-menu-carousel]', root).forEach(function (carousel) {
      var list = $('.menu-list', carousel), nav = $('.menu-carousel__nav', carousel);
      var prev = $('[data-menu-prev]', carousel), next = $('[data-menu-next]', carousel);
      var status = $('.menu-carousel__status', carousel), frame = 0;
      function geometry() {
        var step = list.firstElementChild.offsetWidth + parseFloat(getComputedStyle(list).columnGap || 0);
        return { step: step, count: Math.max(1, Math.floor((list.clientWidth + parseFloat(getComputedStyle(list).columnGap || 0) + 1) / step)) };
      }
      function update() {
        frame = 0;
        var max = list.scrollWidth - list.clientWidth, g = geometry();
        nav.hidden = max <= 1;
        prev.disabled = list.scrollLeft <= 1;
        next.disabled = list.scrollLeft >= max - 1;
        var first = Math.round(list.scrollLeft / g.step) + 1;
        var last = Math.min(list.children.length, first + g.count - 1);
        var text = first + (last > first ? '–' + last : '') + ' / ' + list.children.length;
        if (status.textContent !== text) status.textContent = text;
      }
      function request() { if (!frame) frame = requestAnimationFrame(update); }
      function advance(direction) {
        var g = geometry();
        list.scrollBy({ left: direction * g.step * g.count, behavior: still() ? 'instant' : 'smooth' });
      }
      prev.addEventListener('click', function () { advance(-1); });
      next.addEventListener('click', function () { advance(1); });
      list.addEventListener('scroll', request, { passive: true });
      var observer = 'ResizeObserver' in window ? new ResizeObserver(request) : null;
      if (observer) observer.observe(list);
      else window.addEventListener('resize', request);
      menuCarouselCleanup.push(function () {
        if (observer) observer.disconnect(); else window.removeEventListener('resize', request);
        if (frame) cancelAnimationFrame(frame);
      });
      update();
    });
  }
  function clearMenuCarousels() {
    menuCarouselCleanup.forEach(function (cleanup) { cleanup(); });
    menuCarouselCleanup = [];
  }

  function menuItems(list) {
    return list.map(function (d) {
      var i = DRINKS.indexOf(d);
      var cup = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 8h13v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z"/><path d="M17 9h2a3 3 0 0 1 0 6h-2M7 3v2m4-2v2m4-2v2M3 22h16"/></svg>';
      return '<li class="menu-item"><button class="menu-item__btn menu-card' + (d.image ? ' menu-item__btn--photo' : '') + '" type="button" data-menu-detail="' + i + '" aria-haspopup="dialog"' +
        ' aria-label="' + esc(d.name + ', ' + formatPrice(d.price) + '. Xem chi tiết') + '">' +
        '<span class="menu-card__category"><span>' + esc(d.category) + '</span>' + cup + '</span>' +
        '<span class="menu-card__image">' +
        (d.image ? '<img src="' + esc(d.image) + '" alt="" width="400" height="780" loading="lazy" decoding="async">' : '<span class="menu-card__symbol" aria-hidden="true">' + cup + '</span>') +
        '<span class="menu-item__price">' + formatPrice(d.price) + '</span>' +
        '<span class="menu-card__more" aria-hidden="true">Xem thêm</span></span>' +
        '<span class="menu-item__body"><span class="menu-item__name">' + esc(d.name) + '</span>' +
        (d.description ? '<span class="menu-item__desc">' + esc(d.description) + '</span>' : '') + '</span>' +
        '</button></li>';
    }).join('');
  }

  function bindMenuItems(root) {
    $$('[data-menu-detail]', root).forEach(function (btn) {
      btn.addEventListener('click', function () { openDetails(DRINKS[Number(btn.getAttribute('data-menu-detail'))], btn, 'menu'); });
    });
  }

  /* ---------- Tab: nền tối trượt sang tab mới. Lớp "mực" (chữ kem trên nền charcoal) được cắt theo đúng hình pill,
     nên chữ trong pill luôn kem và chữ ngoài pill luôn charcoal — đủ tương phản ở mọi khung hình. */
  var inkBox = null;
  function moveTabInk(k, animate) {
    var root = $('[data-menu-list]'), ink = $('.menu-tabs__ink', root), tabs = $$('.menu-tab[role="tab"]', root);
    if (!ink || !tabs[k]) return;
    var t = tabs[k], W = ink.offsetWidth, H = ink.offsetHeight;
    var box = { l: t.offsetLeft, r: W - t.offsetLeft - t.offsetWidth, t: t.offsetTop, b: H - t.offsetTop - t.offsetHeight };
    var clip = function (b) { return 'inset(' + b.t + 'px ' + b.r + 'px ' + b.b + 'px ' + b.l + 'px round 999px)'; };
    ink.getAnimations().forEach(function (a) { a.cancel(); });
    if (animate && inkBox && !still()) {
      ink.animate([{ clipPath: clip(inkBox) }, { clipPath: clip(box) }], { duration: 250, easing: 'cubic-bezier(.3,.7,.2,1)' });
    }
    ink.style.clipPath = clip(box);
    inkBox = box;
  }
  /* ---------- Nhóm món: lấy từ config.js → menuCategories (tên Việt, tên Anh, tên cũ tương đương).
     Thứ tự tab = thứ tự trong cấu hình; nhóm có trong dữ liệu nhưng chưa khai báo được thêm vào cuối, không mất món. */
  function groupHeading(g, tag) {
    return '<' + tag + ' class="menu-group__title"><span class="menu-group__vi">' + esc(g.name) + '</span>' +
      (g.en ? '<span class="menu-group__en" lang="en">' + esc(g.en) + '</span>' : '') + '</' + tag + '>';
  }
  function groupList(g, carousel) {
    if (!carousel) return g.items.length
      ? '<ul class="menu-list" role="list">' + menuItems(g.items) + '</ul>'
      : '<p class="note menu-group__empty">Món trong nhóm này đang được cập nhật.</p>';
    return g.items.length
      ? '<div class="menu-carousel" data-menu-carousel>' +
        '<ul class="menu-list" role="list" tabindex="0" aria-label="' + esc('Các món ' + g.name + '. Cuộn ngang để xem thêm') + '">' + menuItems(g.items) + '</ul>' +
        '<div class="menu-carousel__nav" role="group" aria-label="' + esc('Xem thêm món ' + g.name) + '" hidden>' +
        '<button class="menu-carousel__button" type="button" data-menu-prev aria-label="' + esc('Món trước trong ' + g.name) + '">‹</button>' +
        '<span class="menu-carousel__status" aria-live="polite" aria-atomic="true"></span>' +
        '<button class="menu-carousel__button" type="button" data-menu-next aria-label="' + esc('Món tiếp theo trong ' + g.name) + '">›</button>' +
        '</div></div>'
      : '<p class="note menu-group__empty">Món trong nhóm này đang được cập nhật.</p>';
  }
  function showMenuTab(k, focus, animate) {
    if (finishMenuReveal) finishMenuReveal();
    var root = $('[data-menu-list]');
    var panelEl = $('#menu-panel', root);
    var tk = ++menuToken;
    menuTab = k;
    $$('.menu-tab[role="tab"]', root).forEach(function (t, j) {
      var on = j === k;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    panelEl.setAttribute('aria-labelledby', 'menu-tab-' + k);
    moveTabInk(k, animate);
    function render() {
      clearMenuCarousels();
      var tab = menuTabs[k];
      // "Tất cả": từng nhóm có món, mỗi nhóm có tiêu đề Việt + Anh; một nhóm: tiêu đề + danh sách (hoặc ghi chú nếu chưa có món)
      panelEl.innerHTML = tab.all
        ? menuTabs.slice(1).filter(function (g) { return g.items.length; }).map(function (g) {
            return '<section class="menu-group">' + groupHeading(g, 'h3') + groupList(g, true) + '</section>';
          }).join('')
        : '<section class="menu-group">' + groupHeading(tab, 'h3') + groupList(tab) + '</section>';
      bindMenuItems(panelEl);
      bindMenuCarousels(panelEl);
    }
    // Each category owns its natural height; retaining the tallest tab leaves empty rows below short lists.
    panelEl.style.removeProperty('min-height');
    var o = Number(getComputedStyle(panelEl).opacity);
    cancelAll(menuAnims);
    if (!animate || still()) { render(); return; }
    // danh sách: mờ ra 90ms → đổi nhóm → hiện lại 170ms, dịch lên 6px (tổng ≤ 300ms); bấm nhanh thì nhóm chọn cuối thắng
    var out = panelEl.animate([{ opacity: o }, { opacity: 0 }], { duration: Math.max(30, Math.round(100 * o)), easing: 'cubic-bezier(.4,0,1,1)', fill: 'forwards' });
    menuAnims.push(out);
    out.onfinish = function () {
      if (tk !== menuToken) return;
      render();
      out.cancel();
      menuAnims.push(panelEl.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 150, easing: 'cubic-bezier(.2,.7,.2,1)' }));
    };
  }
  function renderMenu() {
    clearMenuCarousels();
    var root = $('[data-menu-list]');
    if (!root) return;
    if (!DRINKS.length) { root.innerHTML = '<p class="note">Thực đơn đang được cập nhật.</p>'; return; }
    var groups = CATEGORIES.map(function (c) { return { name: c.name, en: c.en, items: [] }; }), byName = {};
    groups.forEach(function (g) { byName[g.name] = g; });
    DRINKS.forEach(function (d) {
      if (!byName[d.category]) { byName[d.category] = { name: d.category, en: '', items: [] }; groups.push(byName[d.category]); }
      byName[d.category].items.push(d);
    });
    groups = groups.filter(function (g) { return g.items.length; });
    if (groups.length < 2) {                         // one group: a plain list, no tabs
      menuTabs = null;
      root.innerHTML = '<ul class="menu-list" role="list">' + menuItems(DRINKS) + '</ul>';
      bindMenuItems(root);
      bindMenuCarousels(root);
      return;
    }
    menuTabs = [{ name: 'Tất cả', all: true, items: DRINKS }].concat(groups);
    menuTab = Math.min(menuTab, menuTabs.length - 1);
    root.innerHTML =
      '<div class="menu-tabs" role="tablist" aria-label="Nhóm món">' + menuTabs.map(function (t, k) {
        return '<button class="menu-tab" type="button" role="tab" id="menu-tab-' + k + '" aria-controls="menu-panel" aria-selected="false" tabindex="-1" data-tab="' + k + '"' +
          (t.en ? ' title="' + esc(t.en) + '"' : '') + '>' + esc(t.name) + '</button>';
      }).join('') +
      '<span class="menu-tabs__ink" aria-hidden="true">' + menuTabs.map(function (t) { return '<span class="menu-tab menu-tab--ink">' + esc(t.name) + '</span>'; }).join('') + '</span>' +
      '</div>' +
      '<div id="menu-panel" role="tabpanel"></div>';
    var tabs = $$('.menu-tab[role="tab"]', root);
    tabs.forEach(function (t, k) { t.addEventListener('click', function () { showMenuTab(k, false, true); }); });
    $('.menu-tabs', root).addEventListener('keydown', function (e) {
      var n = tabs.length, k = { ArrowRight: menuTab + 1, ArrowLeft: menuTab - 1, Home: 0, End: n - 1 }[e.key];
      if (k === undefined) return;
      e.preventDefault();
      showMenuTab((k + n) % n, true, true);
    });
    showMenuTab(menuTab, false, false);
    window.addEventListener('resize', function () { moveTabInk(menuTab, false); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { moveTabInk(menuTab, false); });
  }

  /* One-time entrance: heading, filters, group rules and staggered product cards. */
  function setupMenuReveal() {
    var menu = $('#thuc-don');
    var body = $('[data-menu-list]');
    var heading = menu && $('.section-head', menu);
    if (!body || !heading || still() || !('IntersectionObserver' in window)) return;
    var intro = [$('.eyebrow', heading), $('#menu-title'), $('.menu-tabs', body)].filter(Boolean);
    var targets = [];
    function prepare(el, delay) {
      el.setAttribute('data-menu-reveal', '');
      el.style.setProperty('--menu-reveal-delay', delay + 'ms');
      targets.push(el);
    }
    intro.forEach(function (el, k) { prepare(el, [0, 60, 140][k]); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target === heading) intro.forEach(function (el) { el.classList.add('is-in'); });
        else entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .1 });
    io.observe(heading);
    $$('.menu-group__title', body).forEach(function (el) { prepare(el, 180); io.observe(el); });
    $$('.menu-list', body).forEach(function (list) {
      var columns = Math.max(1, Math.round(list.clientWidth / list.firstElementChild.offsetWidth));
      $$('.menu-item', list).forEach(function (el, k) {
        prepare(el, 240 + Math.min(k % columns, 2) * 80); io.observe(el);
      });
    });
    menu.classList.add('is-menu-reveal-ready');
    finishMenuReveal = function () {
      menu.classList.add('is-menu-reveal-finished');
      targets.forEach(function (el) { el.classList.add('is-in'); }); io.disconnect();
    };
    menu.addEventListener('focusin', function () { finishMenuReveal(); });
    reduceMotion.addEventListener('change', function () { if (still()) finishMenuReveal(); });
  }

  (function setupExperiencesReveal() {
    var section = $('.experiences');
    if (!section || still() || !('IntersectionObserver' in window)) return;
    var targets = [$('.experiences__heading', section)].concat($$('.experiences__grid > li', section)).filter(Boolean);
    targets.forEach(function (el, k) {
      el.style.setProperty('--experience-delay', (k ? (k - 1) * 100 : 0) + 'ms');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-experience-in');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: .12 });
    section.classList.add('is-experience-ready');
    targets.forEach(function (el) { observer.observe(el); });
    reduceMotion.addEventListener('change', function () {
      if (!still()) return;
      targets.forEach(function (el) { el.classList.add('is-experience-in'); });
      observer.disconnect();
    });
  })();

  (function setupSpaceReveal() {
    var space = $('#khong-gian');
    if (!space || still() || !('IntersectionObserver' in window)) return;
    var heading = $('.section-head', space);
    var intro = Array.prototype.slice.call(heading.children);
    var cards = $$('.space-card', space);
    var targets = intro.concat(cards);
    intro.forEach(function (el, k) {
      el.setAttribute('data-space-reveal', '');
      el.style.setProperty('--space-reveal-delay', k * 80 + 'ms');
    });
    cards.forEach(function (el, k) {
      el.setAttribute('data-space-reveal', '');
      el.style.setProperty('--space-reveal-delay', k * 100 + 'ms');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        (entry.target === heading ? intro : [entry.target]).forEach(function (el) { el.classList.add('is-space-in'); });
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    function finish() {
      space.classList.remove('is-space-ready');
      targets.forEach(function (el) { el.classList.add('is-space-in'); });
      observer.disconnect();
    }
    space.classList.add('is-space-ready');
    [heading].concat(cards).forEach(function (el) { observer.observe(el); });
    space.addEventListener('focusin', finish);
    reduceMotion.addEventListener('change', function () { if (still()) finish(); });
  })();

  (function setupVisitMotion() {
    var visit = $('.visit--destination');
    if (!visit || still() || !('IntersectionObserver' in window)) return;
    var targets = $$('.destination__heading, .destination__map, .destination__card', visit);
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-destination-in');
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    function finish() {
      visit.classList.remove('is-destination-ready');
      targets.forEach(function (el) { el.classList.add('is-destination-in'); });
      observer.disconnect();
    }
    visit.classList.add('is-destination-ready');
    targets.forEach(function (el) { observer.observe(el); });
    visit.addEventListener('focusin', finish);
    reduceMotion.addEventListener('change', function () {
      if (still()) finish();
    });
  })();

  function renderShop(shop) {
    // Liên kết công khai chỉ lấy từ HOMELODY_CONFIG.links (landing.js).
  }

  function setupReveal() {
    if (still() || !('IntersectionObserver' in window)) return;
    var groups = [
      '.drinks__copy > .eyebrow, .drinks__title, .drink-info',
      '.story__inner > .eyebrow, .story__title',
      '.bakery__copy, .bakery__media',
      '.section-head',
      '.gallery__item'
    ];
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -15% 0px', threshold: 0.1 });
    groups.forEach(function (sel) {
      $$(sel).forEach(function (el, k) {
        if (el.closest('#thuc-don, #khong-gian, #cau-chuyen')) return;
        el.setAttribute('data-reveal', '');
        var list = el.closest('.menu-list');
        el.style.setProperty('--i', list ? Array.prototype.indexOf.call(list.children, el) % 6 : k % 4);
        io.observe(el);
      });
    });
  }

  /* ================================================================== BOOT */
  loadData().then(function (data) {
    SOURCE = data.source;
    DRINKS = data.drinks.filter(function (d) { return d.name; });
    // Bàn xoay chỉ trình bày món có ảnh hoàn chỉnh; món chưa có ảnh vẫn nằm trong dữ liệu và thực đơn dạng chữ.
    // Món đầu tiên (theo thứ tự trong /admin) là món mặc định.
    var max = Number(CFG.maxFeatured) || 6;
    var hasImage = function (d) { return !!d.image; };
    FEATURED = DRINKS.filter(function (d) { return d.featured && hasImage(d); }).slice(0, max);
    if (!FEATURED.length) FEATURED = DRINKS.filter(hasImage).slice(0, 4);
    document.documentElement.setAttribute('data-menu-source', SOURCE);


    renderMenu();
    setupMenuReveal();
    renderShop(data.shop);

    if (!FEATURED.length) {
      field.name.textContent = 'Thực đơn đang cập nhật';
      field.description.textContent = ''; field.price.textContent = ''; field.note.textContent = '';
      stageBtn.hidden = true; optionsRoot.hidden = true;
      $$('[data-open-drink]').forEach(function (b) { b.hidden = true; });
      setupReveal();
      return;
    }

    // Các ảnh ở dưới hero tải lazy; ảnh được chọn sẽ decode trước khi commit.
    renderSelector();
    current = 0;
    renderOptions();
    var first = FEATURED[0];
    setStageTone(first);
    var g = currentGlass(), img = $('img', g);
    if (img.getAttribute('src') !== imgSrc(first)) img.src = imgSrc(first);
    img.alt = first.alt;
    setTextNow(first);
    fillDialog(first);
    lockInfoHeight();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(lockInfoHeight);
    setupReveal();
    ready(img, 2500).then(function () {
      layoutGlass(g);
      movePill(true);
      armIntro();
    });
  });
})();
