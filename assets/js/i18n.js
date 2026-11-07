/* Small, dependency-free VI/EN layer. Language URLs survive sharing and storage denial. */
(function () {
  'use strict';
  var url = new URL(location.href), requested = url.searchParams.get('lang'), saved;
  try { saved = localStorage.getItem('homelody:language'); } catch (_) {}
  var lang = /^(vi|en)$/.test(requested || '') ? requested : saved === 'en' ? 'en' : 'vi';
  var english = lang === 'en', dictionary = window.HOMELODY_EN || {};
  document.documentElement.lang = lang;
  try { localStorage.setItem('homelody:language', lang); } catch (_) {}
  function t(value) {
    if (!english || typeof value !== 'string') return value;
    var key = value.trim(), result = dictionary[key];
    if (!result) {
      result = key.replace(/Món được yêu thích/g, 'House favourite').replace(/\. Xem chi tiết/g, '. View details')
        .replace(/^Các món (.+)\. Cuộn ngang để xem thêm$/, function (_, cat) { return t(cat) + ' items. Swipe to see more'; })
        .replace(/^Xem thêm món (.+)$/, function (_, cat) { return 'More ' + t(cat); })
        .replace(/^Món trước trong (.+)$/, function (_, cat) { return 'Previous item in ' + t(cat); })
        .replace(/^Món tiếp theo trong (.+)$/, function (_, cat) { return 'Next item in ' + t(cat); })
        .replace(/^Đọc toàn bộ đánh giá của (.+)$/, 'Read the full review by $1')
        .replace(/^Xem đánh giá Google của (.+)$/, 'View the Google review by $1')
        .replace(/\/5 sao$/, '/5 stars')
        .replace(/(\d+) món/g, '$1 items');
    }
    return value.replace(key, result);
  }
  function product(d) {
    if (!english) return d;
    var fallback = (window.HOMELODY_PRODUCT_EN || {})[d.name] || [];
    return Object.assign({}, d, {
      sourceName: d.name,
      name: d.name_en || fallback[0] || d.name,
      description: d.description_en || fallback[1] || '',
      note: d.note_en || fallback[2] || '',
      ingredients: d.ingredients_en && d.ingredients_en.length ? d.ingredients_en : d.ingredients.map(function (value) { return value === 'Đá xay' ? 'Crushed ice' : t(value); }),
      alt: d.image_alt_en || d.name_en || fallback[0] || d.name
    });
  }
  var attrs = ['aria-label', 'title', 'alt', 'placeholder'];
  function translate(root) {
    if (!english || !root || root.nodeType === 8) return;
    if (root.nodeType === 3) {
      if (root.parentElement && !root.parentElement.closest('script,style,svg,[data-no-translate]')) {
        var next = t(root.nodeValue); if (next !== root.nodeValue) root.nodeValue = next;
      }
      return;
    }
    if (root.nodeType !== 1 || root.matches('script,style,svg,[data-no-translate]')) return;
    attrs.forEach(function (attr) { if (root.hasAttribute(attr)) { var old = root.getAttribute(attr), next = t(old); if (next !== old) root.setAttribute(attr, next); } });
    Array.from(root.childNodes).forEach(translate);
  }
  window.HOMELODY_I18N = { lang: lang, t: t, product: product, translate: translate };
  // This script runs before the animation modules split headings into words.
  translate(document.documentElement);
  if (english) {
    document.title = t(document.title);
    document.querySelector('meta[property="og:locale"]').content = 'en_US';
    ['description', 'og:description', 'twitter:description'].forEach(function (name) {
      var meta = document.querySelector('meta[name="' + name + '"],meta[property="' + name + '"]');
      if (meta) meta.content = 'Garden café at 100 Ly Thuong Kiet, Hoi An – koi pond, quiet air-conditioned upstairs room for working, salted coffee and homemade cheese bread. Open 6:30am–10pm.';
    });
    ['og:title', 'twitter:title'].forEach(function (name) { var m = document.querySelector('meta[name="' + name + '"],meta[property="' + name + '"]'); if (m) m.content = document.title; });
    var canonical = 'https://homelodyhoian.com/?lang=en';
    document.querySelector('link[rel="canonical"]').href = canonical;
    document.querySelector('meta[property="og:url"]').content = canonical;
    new MutationObserver(function (records) {
      records.forEach(function (record) {
        if (record.type === 'childList') record.addedNodes.forEach(translate);
        else translate(record.target);
      });
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attrs });
  }
  document.querySelectorAll('[data-language]').forEach(function (link) {
    var target = link.dataset.language, dest = new URL(location.href);
    dest.searchParams.set('lang', target); link.href = dest.href;
    link.setAttribute('aria-current', target === lang ? 'true' : 'false');
    link.addEventListener('click', function () { try { localStorage.setItem('homelody:language', target); } catch (_) {} });
  });
})();
