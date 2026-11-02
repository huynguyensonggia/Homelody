/* Shared by the public website and admin: saved overrides, then original website links. */
(function () {
  'use strict';
  var fields = [
    { name: 'facebook_url', key: 'FACEBOOK_URL', label: 'Facebook', placeholder: 'https://www.facebook.com/...' },
    { name: 'instagram_url', key: 'INSTAGRAM_URL', label: 'Instagram', placeholder: 'https://www.instagram.com/...' },
    { name: 'zalo_url', key: 'ZALO_URL', label: 'Zalo', placeholder: 'https://zalo.me/...' },
    { name: 'grabfood_url', key: 'GRABFOOD_URL', label: 'GrabFood', placeholder: 'https://app.grab.com/...' },
    { name: 'shopeefood_url', key: 'SHOPEEFOOD_URL', label: 'ShopeeFood', placeholder: 'https://shopeefood.vn/...' },
    { name: 'tiktok_url', key: 'TIKTOK_URL', label: 'TikTok', placeholder: 'https://www.tiktok.com/@...' }
  ];
  function webUrl(value) {
    if (typeof value !== 'string') return '';
    value = value.trim();
    if (!value || value.length > 2048 || /[\u0000-\u0020\\]/.test(value)) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = 'https://' + value;
    try {
      var url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password && url.hostname.includes('.') ? url.href : '';
    } catch (_) { return ''; }
  }
  function phoneUrl(value) {
    if (typeof value !== 'string') return '';
    var phone = value.replace(/^tel:/i, '').replace(/[\s().-]/g, '');
    return /^\+?\d{8,15}$/.test(phone) ? 'tel:' + phone : '';
  }
  function formatPhone(value) {
    var phone = (phoneUrl(value) || '').replace(/^tel:/, '');
    return /^0\d{9}$/.test(phone) ? phone.slice(0, 4) + ' ' + phone.slice(4, 7) + ' ' + phone.slice(7) : phone;
  }
  function resolveLinks(shop) {
    var defaults = (window.HOMELODY_CONFIG || {}).links || {};
    var saved = shop && (shop.public_links || shop.publicLinks) || {};
    var links = {};
    fields.map(function (field) { return field.key; }).concat(['MAPS_URL', 'PHONE']).forEach(function (key) {
      var validate = key === 'PHONE' ? phoneUrl : webUrl;
      links[key] = validate(saved[key]) || validate(defaults[key]);
    });
    return links;
  }
  window.HOMELODY_SHOP_SETTINGS = { fields: fields, webUrl: webUrl, phoneUrl: phoneUrl, formatPhone: formatPhone, resolveLinks: resolveLinks };
})();
