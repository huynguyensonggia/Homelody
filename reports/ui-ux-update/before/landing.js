/* HOMELODY — public links, booking, delivery, mobile actions and click events. */
(function () {
  'use strict';
  var cfg = window.HOMELODY_CONFIG || {}, links = cfg.links || {};
  (function setupHeroInk() {
    var media = document.querySelector('.hero__media');
    if (!media) return;
    var image = media.querySelector('img'), wash = media.querySelector('.hero__ink-wash');
    if (!image || !wash) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var started = false, finished = false, timeout;
    function finish() {
      finished = true; clearTimeout(timeout);
      media.classList.remove('is-ink-revealing');
      wash.remove();
      image.removeEventListener('load', start);
      image.removeEventListener('error', finish);
      reduce.removeEventListener('change', motionChange);
    }
    function start() {
      if (started || finished) return;
      var bounds = media.getBoundingClientRect();
      if (reduce.matches || !image.naturalWidth || bounds.bottom <= 0 || bounds.top >= window.innerHeight) { finish(); return; }
      started = true; clearTimeout(timeout);
      media.classList.add('is-ink-revealing');
      timeout = setTimeout(finish, 1800);
    }
    function motionChange() { if (reduce.matches) finish(); }
    if (reduce.matches) { finish(); return; }
    wash.addEventListener('animationend', finish, { once: true });
    reduce.addEventListener('change', motionChange);
    if (image.complete) start();
    else {
      image.addEventListener('load', start, { once: true });
      image.addEventListener('error', finish, { once: true });
      timeout = setTimeout(finish, 2500);
    }
  })();
  (function setupChapterCover() {
    var chapters = document.querySelector('[data-story-space]');
    if (!chapters || !window.CSS || !CSS.supports('position', 'sticky')) return;
    var story = chapters.querySelector('#cau-chuyen'), space = chapters.querySelector('#khong-gian');
    var header = document.querySelector('[data-header]'), mobileOrder = document.querySelector('[data-mobile-order]');
    if (!story || !space) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var height = window.innerHeight, headerHeight = 0, enabled = false, lastProgress = -1;
    var scrollFrame = 0, measureFrame = 0;
    function update() {
      scrollFrame = 0;
      if (!enabled) return;
      var progress = Math.max(0, Math.min(1, (height - space.getBoundingClientRect().top) / Math.max(1, height - headerHeight)));
      if (Math.abs(progress - lastProgress) < .0005) return;
      lastProgress = progress;
      chapters.style.setProperty('--story-cover-shade', (progress * .12).toFixed(4));
      chapters.style.setProperty('--story-cover-scale', (1 - progress * .02).toFixed(4));
      chapters.style.setProperty('--chapter-cover-radius', ((1 - progress) * 36).toFixed(2) + 'px');
      chapters.classList.toggle('is-story-covered', progress >= .999);
    }
    function request() { if (!scrollFrame) scrollFrame = requestAnimationFrame(update); }
    function measure() {
      measureFrame = 0;
      enabled = !reduce.matches;
      height = window.innerHeight;
      headerHeight = header ? header.getBoundingClientRect().height : 0;
      var bottomInset = mobileOrder && !mobileOrder.hidden && getComputedStyle(mobileOrder).position === 'fixed' ? mobileOrder.getBoundingClientRect().height : 0;
      // A tall story scrolls naturally first, then pins with its bottom above any fixed mobile controls.
      var pinTop = Math.min(headerHeight, height - bottomInset - story.offsetHeight);
      chapters.style.setProperty('--story-pin-top', pinTop + 'px');
      chapters.style.setProperty('--chapter-viewport-height', height + 'px');
      chapters.style.setProperty('--chapter-header-height', headerHeight + 'px');
      chapters.classList.toggle('is-cover-enabled', enabled);
      if (!enabled) chapters.classList.remove('is-story-covered');
      lastProgress = -1; request();
    }
    function requestMeasure() { if (!measureFrame) measureFrame = requestAnimationFrame(measure); }
    function storyStart(behavior) {
      window.scrollTo({ top: Math.max(0, chapters.getBoundingClientRect().top + window.scrollY - headerHeight), behavior: behavior });
    }
    // Hash navigation targets the chapter's flow origin, even while its story is pinned below.
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[href="#cau-chuyen"]');
      if (!enabled || !link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      if (window.location.hash !== '#cau-chuyen') history.pushState(history.state, '', '#cau-chuyen');
      storyStart('smooth');
    });
    window.addEventListener('hashchange', function () {
      if (enabled && window.location.hash === '#cau-chuyen') requestAnimationFrame(function () { storyStart('instant'); });
    });
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', requestMeasure);
    reduce.addEventListener('change', measure);
    if ('ResizeObserver' in window) {
      var observer = new ResizeObserver(requestMeasure);
      observer.observe(story);
      if (header) observer.observe(header);
      if (mobileOrder) observer.observe(mobileOrder);
    }
    if (document.fonts) document.fonts.ready.then(measure);
    measure();
  })();
  (function setupStoryWords() {
    var story = document.querySelector('#cau-chuyen'), space = document.querySelector('#khong-gian');
    if (!story || !space || !('requestAnimationFrame' in window)) return;
    var paragraphs = Array.from(story.querySelectorAll('.story__body'));
    if (!paragraphs.length) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var header = document.querySelector('[data-header]'), mobileOrder = document.querySelector('[data-mobile-order]');
    var frame = 0, groups = [];
    function clamp(value) { return Math.max(0, Math.min(1, value)); }
    paragraphs.forEach(function (paragraph) {
      var walker = document.createTreeWalker(paragraph, NodeFilter.SHOW_TEXT), nodes = [], node, words = [];
      while ((node = walker.nextNode())) nodes.push(node);
      nodes.forEach(function (textNode) {
        var fragment = document.createDocumentFragment();
        (textNode.textContent.match(/\s+|\S+/gu) || []).forEach(function (token) {
          if (/^\s+$/u.test(token)) fragment.appendChild(document.createTextNode(token));
          else {
            var word = document.createElement('span');
            word.className = 'story__word'; word.textContent = token;
            fragment.appendChild(word); words.push({ el: word, value: -1 });
          }
        });
        textNode.replaceWith(fragment);
      });
      // Prevent any cached paragraph entrance effect from also fading the parent.
      paragraph.removeAttribute('data-story-reveal');
      groups.push({ paragraph: paragraph, words: words });
    });
    function update() {
      frame = 0;
      if (reduce.matches) return;
      var height = window.innerHeight;
      var headerHeight = header ? header.getBoundingClientRect().height : 0;
      var bottomInset = mobileOrder && !mobileOrder.hidden && getComputedStyle(mobileOrder).position === 'fixed' ? mobileOrder.getBoundingClientRect().height : 0;
      var available = Math.max(100, height - headerHeight - bottomInset);
      var startLine = headerHeight + available * .92;
      var finishLine = headerHeight + available * .46;
      var lead = Math.min(220, available * .3);
      // Finish before the next chapter reaches the readable viewport, including mobile controls.
      var deadline = clamp((height - bottomInset + lead - space.getBoundingClientRect().top) / lead);
      var boundsByParagraph = groups.map(function (group) { return group.paragraph.getBoundingClientRect(); });
      groups.forEach(function (group, groupIndex) {
        var bounds = boundsByParagraph[groupIndex];
        var progress = Math.max(deadline, clamp((startLine - bounds.top) / (startLine - finishLine + bounds.height)));
        group.words.forEach(function (word, index) {
          var value = Math.round(clamp((progress * (group.words.length + 7) - index) / 7) * 1000) / 1000;
          if (word.value === value) return;
          word.value = value;
          word.el.style.setProperty('--word-reveal', value);
        });
      });
    }
    function request() { if (!frame) frame = requestAnimationFrame(update); }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request);
    reduce.addEventListener('change', request);
    if ('ResizeObserver' in window) {
      var observer = new ResizeObserver(request);
      observer.observe(story);
      if (mobileOrder) observer.observe(mobileOrder);
    }
    if (document.fonts) document.fonts.ready.then(request);
    update();
    story.classList.add('has-scroll-words');
  })();
  (function setupStatistics() {
    var section = document.querySelector('[data-stats]');
    if (!section) return;
    var data = cfg.statistics || {}, reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    var counters = [], frame = 0, started = false;
    section.querySelectorAll('[data-stat-value]').forEach(function (el) {
      var key = el.dataset.statValue, value = data[key];
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 ||
          (key === 'rating' && value > 5) || (key === 'foundedYear' && value < 1)) return;
      var decimals = key === 'rating' ? 1 : 0;
      var format = new Intl.NumberFormat('vi-VN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: key !== 'foundedYear' });
      counters.push({ el: el, value: value, format: format });
      el.textContent = format.format(reduced.matches ? value : 0);
      var suffix = section.querySelector('[data-stat-suffix="' + key + '"]');
      if (suffix) suffix.hidden = false;
    });
    function finish() {
      cancelAnimationFrame(frame);
      counters.forEach(function (counter) { counter.el.textContent = counter.format.format(counter.value); });
    }
    function start() {
      if (started || !counters.length) return;
      started = true;
      if (reduced.matches) { finish(); return; }
      var startTime;
      function tick(now) {
        if (startTime === undefined) startTime = now;
        var progress = Math.min((now - startTime) / 1800, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        counters.forEach(function (counter) {
          var value = counter.value * eased;
          counter.el.textContent = counter.format.format(counter.el.dataset.statValue === 'rating' ? value : Math.floor(value));
        });
        if (progress < 1) frame = requestAnimationFrame(tick); else finish();
      }
      frame = requestAnimationFrame(tick);
    }
    if ('IntersectionObserver' in window) {
      var observer = new IntersectionObserver(function (entries) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        observer.disconnect(); start();
      }, { threshold: .35 });
      observer.observe(section);
    } else start();
    reduced.addEventListener('change', function () { if (reduced.matches) finish(); });
  })();
  var icons = {
    java: '<path fill="currentColor" d="M10.82 8.427c-.76-1.085-1.046-1.872-1.108-2.445c-.059-.54.073-.97.335-1.383c.283-.447.708-.862 1.248-1.353c.505-.458 1.137-1.003 1.633-1.62L11.37.374c-.416.517-.928.947-1.418 1.391c-.534.485-1.149 1.062-1.593 1.764c-.466.735-.75 1.611-.635 2.67c.112 1.026.588 2.132 1.458 3.375zm1.25-3.03c.284-.684.861-1.37 1.78-2.156l1.3 1.518c-.831.713-1.129 1.153-1.235 1.407c-.104.25-.035.499.035.747c.084.296.223.79.214 1.322c-.012.706-.254 1.452-.832 2.32l-1.664-1.11c.422-.632.492-1.01.496-1.243c.005-.295-.072-.46-.197-.96c-.12-.478-.21-1.097.102-1.845M6.141 10c.47-.314 1.05-.474 1.592-.604L7.266 7.45c-.813.196-1.551.46-2.112.807C4.644 8.573 4 9.136 4 10c0 .726.486 1.306 1.065 1.686a2.5 2.5 0 0 0-.065.572c0 .98.418 1.807 1.143 2.42c-.107.3-.155.634-.14.968c-.777.151-1.536.373-2.17.664c-.432.198-.858.451-1.19.777c-.334.329-.643.804-.643 1.413c0 .427.189.772.374 1.01c.189.242.432.449.684.624c.506.351 1.184.669 1.959.936c1.558.538 3.669.93 5.983.93c3.327 0 5.663-.384 7.19-.782a13 13 0 0 0 1.704-.561c.21-.088.42-.181.616-.297c.01-.006-1.028-1.715-1.024-1.718c-.564.294-1.188.48-1.8.64c-1.349.352-3.513.718-6.686.718c-2.104 0-3.993-.358-5.33-.82c-.532-.184-1.088-.398-1.541-.74c.115-.09.29-.199.538-.312c.558-.256 1.323-.466 2.14-.591q.344.365.814.64c.965.562 2.292.823 3.879.823c1.31 0 2.258-.132 2.898-.274c.356-.078.714-.167 1.042-.328c.003-.002-.881-1.795-.881-1.795q-.291.105-.593.17c-.489.109-1.29.227-2.466.227c-1.413 0-2.336-.24-2.871-.551c-.426-.248-.589-.524-.622-.824c.868.253 1.895.375 3.056.375c1.463 0 2.518-.143 3.228-.297c.386-.083.775-.179 1.134-.346c.02-.01-.857-1.807-.857-1.807a4.4 4.4 0 0 1-.7.198c-.56.121-1.473.252-2.806.252c-1.603 0-2.67-.264-3.302-.623c-.471-.268-.678-.568-.74-.89c1.24.326 2.805.513 4.48.513c1.817 0 3.502-.22 4.783-.598l-.566-1.918c-1.054.311-2.54.516-4.217.516c-1.724 0-3.245-.216-4.302-.542c-.5-.153-.846-.316-1.056-.458m11.448.746c1.213-.11 1.66.188 1.804.342c.149.16.201.408.136.67c-.116.464-.443.914-.973 1.328c-.529.413-1.2.74-1.873.965l.632 1.897c.828-.276 1.718-.698 2.471-1.285c.75-.586 1.424-1.385 1.683-2.42c.185-.74.112-1.741-.614-2.52c-.73-.782-1.909-1.109-3.447-.969z"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    chat: '<path d="M21 11.5a9 9 0 0 1-9 9 10 10 0 0 1-4-.8L3 21l1.3-4.5A9 9 0 1 1 21 11.5Z"/><path d="M8 10h8m-8 4h5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    trees: '<path d="m8 3-5 7h3l-4 6h12l-4-6h3Zm0 13v5m8-15 4 6h-2l4 5h-7m3 0v4"/>',
    music: '<path d="M9 18V5l12-2v13M9 9l12-2"/><ellipse cx="6" cy="18" rx="3" ry="3"/><ellipse cx="18" cy="16" rx="3" ry="3"/>',
    laptop: '<rect x="4" y="3" width="16" height="13" rx="2"/><path d="m4 16-3 5h22l-3-5M10 18h4"/>',
    pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    phone: '<path d="m7 3 3 4-2 3a15 15 0 0 0 6 6l3-2 4 3-1 4C10 22 2 14 3 4Z"/>',
    delivery: '<path d="M3 5h11v12H3Zm11 4h4l3 5v3h-7M5 9h5"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
    grab: '<path d="M19 6a9 9 0 1 0 1 11v-6h-8v3h5v2a5 5 0 1 1-1-7M17 3a12 12 0 1 0 5 16"/>',
    shopee: '<path d="M5 7h14l1 14H4Zm3 0V5a4 4 0 0 1 8 0v2m0 4c-4-3-8 1-3 3s1 5-3 2"/>',
    facebook: '<path d="M14 22V13h3l.5-4H14V6.5c0-1 .5-1.5 1.5-1.5H18V2h-3c-3 0-5 2-5 5v2H7v4h3v9"/>',
    instagram: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
    tiktok: '<path d="M14 3v13a4 4 0 1 1-4-4M14 3c1 4 3 5 7 5v4c-3 0-5-1-7-3"/>'
  };
  // Brand artwork: Simple Icons (CC0), source and license in assets/icons/.
  var brands = {"grab": "<path d=\"M23.129 10.863a2.927 2.927 0 00-2.079-.872c-.57 0-1.141.212-1.455.421-.651.434-1.186.904-2.149 2.148v.894c.817-1.064 1.59-1.903 2.177-2.364.386-.31.933-.501 1.427-.501 1.275 0 2.352 1.077 2.352 2.352v.538c0 .63-.247 1.223-.698 1.668a2.341 2.341 0 01-1.654.685c-1.048 0-1.97-.719-2.22-1.701l-.422.51c.307 1.03 1.417 1.789 2.642 1.789.778 0 1.516-.31 2.079-.872.562-.562.871-1.3.871-2.079v-.538c0-.778-.31-1.517-.871-2.078m-12.8-.274c.406 0 .757.087 1.074.266.149-.186.299-.337.411-.449-.335-.256-.903-.415-1.485-.415-.83 0-1.584.3-2.122.843-.534.54-.83 1.287-.83 2.107v3.489h.598V12.94c0-1.385.968-2.352 2.354-2.352m5.678 5.84v-3.488c0-1.072-.84-1.913-1.913-1.913-.5 0-.976.203-1.343.57a1.895 1.895 0 00-.57 1.343v.538c0 1.037.877 1.913 1.913 1.913.285 0 .671-.07.908-.264v-.631c-.232.187-.57.298-.908.298a1.302 1.302 0 01-1.315-1.316v-.538a1.3 1.3 0 011.315-1.314 1.3 1.3 0 011.316 1.314v3.489zM0 12.596v.193c0 1.036.393 2.003 1.107 2.722a3.759 3.759 0 002.689 1.112c.82 0 1.548-.186 2.162-.551.506-.302.73-.607.75-.635V12.22H3.65v.597H6.11v2.434l-.002.002c-.288.288-.972.77-2.312.77a3.165 3.165 0 01-2.279-.938 3.247 3.247 0 01-.92-2.297v-.193c0-.83.375-1.656 1.026-2.269a3.558 3.558 0 012.442-.967c.847 0 1.438.129 1.913.416v-.67c-.494-.21-1.085-.305-1.913-.305C1.862 8.8 0 10.538 0 12.595m10.329-.968c.226 0 .419.037.571.112.075-.186.151-.339.262-.525-.162-.116-.549-.186-.833-.186-1.09 0-1.913.823-1.913 1.913v3.489h.598V12.94c0-.774.54-1.314 1.315-1.314m-4.351-.702v-.707c-.541-.29-1.131-.419-1.913-.419-.799 0-1.555.293-2.132.824-.577.532-.895 1.233-.895 1.972v.193c0 1.542 1.237 2.796 2.758 2.796 1.237 0 1.745-.405 1.874-.533v-1.794H3.65v.598h1.46v.899l-.005.001c-.187.075-.578.231-1.31.231-.58 0-1.122-.225-1.528-.636a2.203 2.203 0 01-.632-1.562v-.193c0-1.192 1.113-2.198 2.43-2.198.91 0 1.45.147 1.913.528m14.105 1.126c.27-.27.623-.424.967-.424.737 0 1.315.577 1.315 1.314v.538c0 .738-.578 1.316-1.315 1.316-.357 0-.702-.196-.972-.55a2.151 2.151 0 01-.418-1.12l-.484.591c.095.452.33.885.665 1.19.344.313.774.486 1.209.486a1.915 1.915 0 001.913-1.913v-.538c0-.499-.202-.977-.57-1.343a1.896 1.896 0 00-1.343-.57c-.316 0-.818.114-1.417.652l-.002.002c-.16.16-.536.536-.765.804-.384.42-.943 1.054-1.42 1.688v.933c.529-.68.833-1.06 1.33-1.634.445-.519.996-1.15 1.307-1.422m-8.939 1.428c0 .779.31 1.517.872 2.08a2.93 2.93 0 002.078.87c.33 0 .669-.07.908-.188v-.597c-.28.117-.618.188-.908.188-1.274 0-2.352-1.077-2.352-2.353v-.538c0-1.275 1.078-2.352 2.352-2.352a2.34 2.34 0 012.353 2.353v3.488h.598v-3.604a2.979 2.979 0 00-.915-2.006 2.92 2.92 0 00-2.036-.83c-.778 0-1.516.31-2.078.873a2.926 2.926 0 00-.872 2.078zm6.918-2.313c.183-.22.372-.443.596-.631V7.378h-.596zm1.037-.876V7.378h.597V9.88a3.601 3.601 0 00-.597.41\"/>", "shopee": "<path d=\"M15.9414 17.9633c.229-1.879-.981-3.077-4.1758-4.0969-1.548-.528-2.277-1.22-2.26-2.1719.065-1.056 1.048-1.825 2.352-1.85a5.2898 5.2898 0 0 1 2.8838.89c.116.072.197.06.263-.039.09-.145.315-.494.39-.62.051-.081.061-.187-.068-.281-.185-.1369-.704-.4149-.983-.5319a6.4697 6.4697 0 0 0-2.5118-.514c-1.909.008-3.4129 1.215-3.5389 2.826-.082 1.1629.494 2.1078 1.73 2.8278.262.152 1.6799.716 2.2438.892 1.774.552 2.695 1.5419 2.478 2.6969-.197 1.047-1.299 1.7239-2.818 1.7439-1.2039-.046-2.2878-.537-3.1278-1.19l-.141-.11c-.104-.08-.218-.075-.287.03-.05.077-.376.547-.458.67-.077.108-.035.168.045.234.35.293.817.613 1.134.775a6.7097 6.7097 0 0 0 2.8289.727 4.9048 4.9048 0 0 0 2.0759-.354c1.095-.465 1.8029-1.394 1.9449-2.554zM11.9986 1.4009c-2.068 0-3.7539 1.95-3.8329 4.3899h7.6657c-.08-2.44-1.765-4.3899-3.8328-4.3899zm7.8516 22.5981-.08.001-15.7843-.002c-1.074-.04-1.863-.91-1.971-1.991l-.01-.195L1.298 6.2858a.459.459 0 0 1 .45-.494h4.9748C6.8448 2.568 9.1607 0 11.9996 0c2.8388 0 5.1537 2.5689 5.2757 5.7898h4.9678a.459.459 0 0 1 .458.483l-.773 15.5883-.007.131c-.094 1.094-.979 1.9769-2.0709 2.0059z\"/>"};
  function svg(name) {
    if (name === 'java') return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' + icons.java + '</svg>';
    if (brands[name]) return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">' + brands[name] + '</svg>';
    return '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (icons[name] || icons.chat) + '</svg>';
  }
  var social = document.querySelector('[data-social]');
  if (social) {
    var networks = [['Facebook','FACEBOOK_URL','facebook'],['Instagram','INSTAGRAM_URL','instagram'],['Zalo','ZALO_URL','chat'],['Google Maps','MAPS_URL','pin'],['GrabFood','GRABFOOD_URL','grab'],['ShopeeFood','SHOPEEFOOD_URL','shopee'],['TikTok','TIKTOK_URL','tiktok']];
    social.innerHTML = networks.map(function (n) { return '<li><a class="social__link" data-link="' + n[1] + '" aria-label="' + n[0] + '" tabindex="0"><span class="social__tooltip" aria-hidden="true">' + n[0] + '</span>' + svg(n[2]) + '</a></li>'; }).join('');
    social.hidden = false;
  }
  (function setupReviews() {
    var section = document.querySelector('[data-reviews]');
    if (!section) return;
    var wall = section.querySelector('[data-reviews-wall]');
    var toggle = section.querySelector('[data-reviews-pause]');
    var toggleLabel = section.querySelector('[data-reviews-pause-label]');
    var toggleIcon = section.querySelector('[data-reviews-pause-icon]');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var desktop = window.matchMedia('(min-width: 1024px)');
    var tablet = window.matchMedia('(min-width: 768px)');
    var userPaused = false, reading = false, pendingLayout = false, opener = null;
    var entries = Array.isArray(cfg.customerReviews) ? cfg.customerReviews.filter(function (review) {
      return review && typeof review.name === 'string' && review.name.trim() && typeof review.text === 'string' && review.text.trim();
    }) : [];
    var sample = !entries.length;
    if (sample) {
      entries = [
        'Một góc vườn xanh mát, ngồi nhâm nhi cà phê và trò chuyện thật dễ chịu.',
        'Thích nhất những chỗ ngồi dưới tán cây. Một buổi sáng thật chậm và bình yên.',
        'Ly matcha béo dịu, hợp cho một buổi hẹn cùng bạn bè ở góc vườn nhỏ.',
        'Không gian ấm cúng như ghé nhà người quen. Muốn ngồi lại lâu thêm một chút.',
        'Mang theo một cuốn sách, chọn một góc ngồi yên và để thời gian trôi chậm lại.',
        'Cà phê thơm và một khoảng xanh giữa phố. Thật hợp cho cuộc hẹn cuối tuần.',
        'Buổi sáng có nắng xuyên qua tán lá, chụp góc nào cũng thấy thật có cảm xúc.',
        'Một nơi dễ thương để ngồi nghỉ chân sau khi dạo quanh Hội An.',
        'Góc piano và cây xanh khiến cuộc hẹn hôm nay có thêm một chút thi vị.',
        'Thích cảm giác gần gũi ở đây. Hẹn một ngày trở lại cùng những người thân quen.'
      ].map(function (text, index) { return { name: 'Khách mẫu ' + String(index + 1).padStart(2, '0'), text: text, rating: 5 }; });
    }
    section.querySelector('[data-reviews-note]').hidden = !sample;
    function element(tag, className, text) {
      var el = document.createElement(tag);
      if (className) el.className = className;
      if (text !== undefined) el.textContent = text;
      return el;
    }
    var reviewDialog = element('dialog', 'review-dialog');
    reviewDialog.setAttribute('aria-labelledby', 'review-detail-name');
    var closeReview = element('button', 'review-dialog__close', '×');
    closeReview.type = 'button'; closeReview.setAttribute('aria-label', 'Đóng đánh giá');
    var dialogName = element('h2', '', ''); dialogName.id = 'review-detail-name';
    var dialogText = element('p', 'review-dialog__text');
    var dialogSource = element('a', 'review-dialog__source', 'Xem trên Google Maps ↗');
    dialogSource.target = '_blank'; dialogSource.rel = 'noopener';
    reviewDialog.appendChild(closeReview);
    reviewDialog.appendChild(element('p', 'eyebrow', 'Lời nhắn từ khách ghé nhà'));
    reviewDialog.appendChild(dialogName);
    reviewDialog.appendChild(dialogText); reviewDialog.appendChild(dialogSource);
    document.body.appendChild(reviewDialog);
    closeReview.addEventListener('click', function () { reviewDialog.close(); });
    reviewDialog.addEventListener('click', function (event) {
      if (event.target !== reviewDialog) return;
      var bounds = reviewDialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) reviewDialog.close();
    });
    reviewDialog.addEventListener('close', function () {
      document.documentElement.classList.remove('is-review-open');
      section.classList.remove('is-dialog-open');
      if (pendingLayout) { pendingLayout = false; renderColumns(); }
      // Duplicates never receive keyboard focus; return to the fixed control instead.
      if (opener && (opener.closest('.reviews__copy--duplicate') || !opener.isConnected)) {
        (toggle.hidden ? section.querySelector('.reviews__link') : toggle).focus({ preventScroll: true });
      }
    });
    function createCard(review, index) {
      var card = element('figure', 'reviews__card');
      card.setAttribute('role', 'listitem'); card.dataset.reviewIndex = index;
      if (typeof review.rating === 'number' && review.rating >= 0 && review.rating <= 5) {
        var stars = element('span', 'reviews__stars', '★'.repeat(Math.round(review.rating)) + '☆'.repeat(5 - Math.round(review.rating)));
        stars.setAttribute('aria-label', review.rating + '/5 sao'); card.appendChild(stars);
      }
      card.appendChild(element('blockquote', 'reviews__text', review.text));
      var readMore = element('button', 'reviews__read-more', 'Đọc tiếp ↗');
      readMore.type = 'button'; readMore.hidden = true;
      readMore.setAttribute('aria-haspopup', 'dialog');
      readMore.setAttribute('aria-label', 'Đọc toàn bộ đánh giá của ' + review.name);
      card.appendChild(readMore);
      var author = element('figcaption', 'reviews__author');
      var avatar = element('span', 'reviews__avatar', sample ? 'H' : Array.from(review.name.trim())[0]);
      avatar.setAttribute('aria-hidden', 'true'); author.appendChild(avatar);
      var info = element('div', 'reviews__author-info');
      var name = element('span', 'reviews__source', review.name);
      if (typeof review.sourceUrl === 'string' && /^https:\/\/www\.google\.com\/maps\/contrib\/\d+\/reviews(?:\?|$)/.test(review.sourceUrl)) {
        name = element('a', 'reviews__source', review.name + ' ↗');
        name.href = review.sourceUrl; name.target = '_blank'; name.rel = 'noopener';
        name.setAttribute('aria-label', 'Xem đánh giá Google của ' + review.name);
      }
      info.appendChild(name);
      info.appendChild(element('span', 'reviews__author-note', sample ? 'Nội dung mẫu minh họa' :
        (name.tagName === 'A' ? 'Chia sẻ trên Google Maps' : 'Khách ghé Homelody')));
      author.appendChild(info); card.appendChild(author);
      return card;
    }
    function syncControl() {
      var paused = userPaused || reading;
      section.classList.toggle('is-user-paused', userPaused);
      section.classList.toggle('is-reading', reading);
      toggle.setAttribute('aria-pressed', String(paused));
      toggleLabel.textContent = paused ? 'Tiếp tục chuyển động' : 'Tạm dừng';
      toggleIcon.setAttribute('d', paused ? 'M8 5l11 7-11 7Z' : 'M9 6v12m6-12v12');
      toggle.hidden = reduce.matches || section.classList.contains('reviews--static');
    }
    function measure() {
      wall.querySelectorAll('.reviews__card').forEach(function (card) {
        var text = card.querySelector('.reviews__text');
        if (text.clientHeight) card.querySelector('.reviews__read-more').hidden = text.scrollHeight <= text.clientHeight + 1;
      });
      var groups = Array.from(wall.querySelectorAll('.reviews__copy:not(.reviews__copy--duplicate)'));
      var windowHeight = parseFloat(getComputedStyle(wall).getPropertyValue('--reviews-window'));
      // A short column has nothing to loop: show a natural-height list in that case.
      section.classList.toggle('reviews--static', reduce.matches || groups.some(function (group) { return group.offsetHeight <= windowHeight; }));
      groups.forEach(function (group, index) {
        group.parentElement.style.setProperty('--reviews-duration', Math.max(24, group.offsetHeight / 24 * [1, 1.18, 1.06][index % 3]) + 's');
      });
      syncControl();
    }
    var columnCount = 0;
    function renderColumns() {
      if (reviewDialog.open) { pendingLayout = true; return; }
      var count = Math.min(entries.length, desktop.matches ? 3 : tablet.matches ? 2 : 1);
      if (count === columnCount) { measure(); return; }
      var active = wall.contains(document.activeElement) ? document.activeElement : null;
      var activeCard = active && active.closest('[data-review-index]');
      var activeIndex = activeCard && activeCard.dataset.reviewIndex;
      var focusSelector = active && active.matches('a') ? '.reviews__source' : '.reviews__read-more';
      columnCount = count;
      wall.replaceChildren(); wall.style.setProperty('--review-columns', count);
      for (var columnIndex = 0; columnIndex < count; columnIndex++) {
        var column = element('div', 'reviews__column');
        var marquee = element('div', 'reviews__marquee');
        var copy = element('div', 'reviews__copy');
        copy.setAttribute('role', 'list'); copy.setAttribute('aria-label', 'Lời nhắn từ khách, cột ' + (columnIndex + 1));
        entries.forEach(function (review, index) { if (index % count === columnIndex) copy.appendChild(createCard(review, index)); });
        var duplicate = copy.cloneNode(true);
        duplicate.classList.add('reviews__copy--duplicate'); duplicate.setAttribute('aria-hidden', 'true');
        duplicate.querySelectorAll('a, button').forEach(function (el) { el.tabIndex = -1; });
        marquee.appendChild(copy); marquee.appendChild(duplicate); column.appendChild(marquee); wall.appendChild(column);
      }
      measure();
      if (activeCard) {
        reading = true; syncControl();
        var target = wall.querySelector('.reviews__copy:not(.reviews__copy--duplicate) [data-review-index="' + activeIndex + '"] ' + focusSelector);
        if (target && !target.hidden) target.focus({ preventScroll: true });
        else section.querySelector('.reviews__link').focus({ preventScroll: true });
      }
    }
    wall.addEventListener('mousedown', function (event) {
      if (event.target.closest('.reviews__copy--duplicate')) event.preventDefault();
    });
    wall.addEventListener('click', function (event) {
      var button = event.target.closest('.reviews__read-more');
      if (!button) return;
      var card = button.closest('[data-review-index]'), review = entries[Number(card.dataset.reviewIndex)];
      var source = card.querySelector('a.reviews__source');
      opener = button;
      dialogName.textContent = review.name; dialogText.textContent = review.text;
      dialogSource.hidden = !source;
      if (source) dialogSource.href = source.href; else dialogSource.removeAttribute('href');
      section.classList.add('is-dialog-open');
      reviewDialog.showModal(); reviewDialog.scrollTop = 0;
      document.documentElement.classList.add('is-review-open');
    });
    wall.addEventListener('focusin', function (event) {
      if (!event.target.matches(':focus-visible') || event.target.closest('.reviews__copy--duplicate')) return;
      // Keyboard readers get every original card in a stable, unclipped list.
      reading = true; syncControl();
      event.target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    });
    toggle.addEventListener('click', function () {
      if (reading) { reading = false; userPaused = false; }
      else userPaused = !userPaused;
      syncControl(); measure();
    });
    renderColumns();
    if (document.fonts) document.fonts.ready.then(measure);
    if ('ResizeObserver' in window) new ResizeObserver(measure).observe(wall);
    else window.addEventListener('resize', measure);
    desktop.addEventListener('change', renderColumns); tablet.addEventListener('change', renderColumns);
    reduce.addEventListener('change', measure);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (records) { section.classList.toggle('is-visible', records[0].isIntersecting); }).observe(section);
    } else section.classList.add('is-visible');
    function visibility() { section.classList.toggle('is-page-hidden', document.hidden); }
    document.addEventListener('visibilitychange', visibility); visibility();
  })();
  (function setupReviewsEntrance() {
    var section = document.querySelector('[data-reviews]');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!section || reduce.matches || !('IntersectionObserver' in window)) return;
    var heading = section.querySelector('.reviews__heading');
    var intro = Array.from(heading.children);
    var collection = section.querySelector('.reviews__wall');
    var footer = section.querySelector('.reviews__footer');
    var targets = intro.concat([collection, footer]);
    targets.forEach(function (el, i) {
      el.setAttribute('data-review-reveal', '');
      el.style.setProperty('--review-reveal-delay', (i < intro.length ? i * 70 : 0) + 'ms');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        (entry.target === heading ? intro : [entry.target]).forEach(function (el) {
          el.classList.add('is-review-in');
        });
        observer.unobserve(entry.target);
      });
    }, { threshold: .1, rootMargin: '0px 0px -6% 0px' });
    function finish() {
      section.classList.remove('is-review-reveal-ready');
      targets.forEach(function (el) { el.classList.add('is-review-in'); });
      observer.disconnect();
    }
    section.classList.add('is-review-reveal-ready');
    [heading, collection, footer].forEach(function (el) { observer.observe(el); });
    section.addEventListener('focusin', finish);
    reduce.addEventListener('change', function () { if (reduce.matches) finish(); });
  })();
  (function setupFooterEntrance() {
    var footer = document.querySelector('.site-footer--expanded');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!footer || reduce.matches || !('IntersectionObserver' in window)) return;
    var brand = footer.querySelector('.site-footer__brand');
    var brandContent = Array.from(brand.children).filter(function (el) { return !el.classList.contains('brand'); });
    var columns = Array.from(footer.querySelectorAll('.site-footer__column'));
    var targets = brandContent.concat(columns);
    brandContent.forEach(function (el) { el.setAttribute('data-footer-reveal', ''); });
    columns.forEach(function (el, k) {
      el.setAttribute('data-footer-reveal', '');
      el.style.setProperty('--footer-reveal-delay', (k + 1) * 70 + 'ms');
    });
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        (entry.target === brand ? brandContent : [entry.target]).forEach(function (el) { el.classList.add('is-footer-in'); });
        observer.unobserve(entry.target);
      });
    }, { threshold: .1 });
    function finish() {
      footer.classList.remove('is-footer-ready');
      targets.forEach(function (el) { el.classList.add('is-footer-in'); });
      observer.disconnect();
    }
    footer.classList.add('is-footer-ready');
    [brand].concat(columns).forEach(function (el) { observer.observe(el); });
    footer.addEventListener('focusin', finish);
    reduce.addEventListener('change', function () { if (reduce.matches) finish(); });
  })();
  document.querySelectorAll('[data-icon]').forEach(function (el) { el.innerHTML = svg(el.dataset.icon); });
  document.querySelectorAll('[data-link]').forEach(function (el) {
    var url = links[el.dataset.link] || '';
    if (/^(https:\/\/|tel:)/.test(url)) {
      el.setAttribute('href', url); el.removeAttribute('aria-disabled');
      if (url.indexOf('https://') === 0) { el.target = '_blank'; el.rel = 'noopener'; }
    } else {
      el.removeAttribute('href'); el.setAttribute('role', 'link'); el.setAttribute('aria-disabled', 'true');
      el.title = 'Liên kết đặt món chưa được cung cấp';
    }
  });
  var events = { ZALO_URL: 'zalo_booking_click', GRABFOOD_URL: 'grabfood_click', SHOPEEFOOD_URL: 'shopeefood_click', MAPS_URL: 'directions_click', PHONE: 'call_click' };
  document.addEventListener('click', function (e) {
    var link = e.target.closest('[data-link]');
    if (!link) return;
    if (link.getAttribute('aria-disabled') === 'true') { e.preventDefault(); return; }
    var eventName = events[link.dataset.link];
    if (!eventName) return;
    var location = link.closest('[data-location]');
    var data = { event: eventName, position: location ? location.dataset.location : 'menu', link_url: link.href };
    window.dataLayer = window.dataLayer || []; window.dataLayer.push(data);
    window.dispatchEvent(new CustomEvent('homelody:track', { detail: data }));
  });

  var sticky = document.querySelector('[data-mobile-order]'), hero = document.querySelector('.hero');
  var toggle = document.querySelector('[data-delivery-toggle]'), menu = document.getElementById('mobile-delivery-menu');
  var dialog = document.getElementById('drink-dialog'), header = document.querySelector('[data-header]');
  var raf = 0;
  function closeDelivery() { if (menu) menu.hidden = true; if (toggle) toggle.setAttribute('aria-expanded', 'false'); }
  function updateSticky() {
    raf = 0;
    if (!sticky || !hero) return;
    var show = window.innerWidth < 768 && hero.getBoundingClientRect().bottom <= 0 && !dialog.open && !header.classList.contains('is-open');
    sticky.hidden = !show;
    document.body.classList.toggle('has-mobile-order', show);
    if (!show) closeDelivery();
  }
  function request() { if (!raf) raf = requestAnimationFrame(updateSticky); }
  if (toggle) toggle.addEventListener('click', function () { var open = toggle.getAttribute('aria-expanded') !== 'true'; toggle.setAttribute('aria-expanded', String(open)); menu.hidden = !open; });
  document.addEventListener('click', function (e) { if (sticky && !sticky.contains(e.target)) closeDelivery(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && menu && !menu.hidden) { closeDelivery(); toggle.focus(); } });
  window.addEventListener('scroll', request, { passive: true }); window.addEventListener('resize', request);
  if (dialog) new MutationObserver(request).observe(dialog, { attributes: true, attributeFilter: ['open'] });
  if (header) new MutationObserver(request).observe(header, { attributes: true, attributeFilter: ['class'] });
  updateSticky();

  // Fullscreen mobile navigation keeps keyboard focus within the panel and its close button.
  var nav = document.querySelector('[data-nav]'), navToggle = document.querySelector('[data-nav-toggle]');
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !header.classList.contains('is-open')) return;
    var nodes = Array.from(nav.querySelectorAll('a[href]')).concat(navToggle).filter(function (el) { return el.getBoundingClientRect().width > 0; });
    var first = nodes[0], last = nodes[nodes.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();
