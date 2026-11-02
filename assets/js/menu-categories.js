/* Category metadata is shared by the public menu and admin. Renames retain aliases. */
(function () {
  'use strict';
  function key(value) { return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().replace(/\s+/g, ' '); }
  function normalize(rows) {
    return rows.filter(function (row) { return row && typeof row.name === 'string' && row.name.trim(); }).map(function (row, index) {
      return { id: String(row.id || 'original-' + index), name: row.name.trim(), en: String(row.en || '').trim(), aliases: Array.isArray(row.aliases) ? row.aliases.filter(function (alias) { return typeof alias === 'string' && alias.trim(); }) : [], is_active: row.is_active !== false };
    });
  }
  function resolve(shop, drinks) {
    var saved = shop && (shop.menu_categories !== undefined ? shop.menu_categories : shop.menuCategories);
    var rows = normalize(Array.isArray(saved) ? saved : ((window.HOMELODY_CONFIG || {}).menuCategories || []));
    (drinks || []).forEach(function (drink) {
      var name = String(drink.category || '').trim();
      if (name && !find(rows, name)) rows.push({ id: 'unlisted-' + encodeURIComponent(key(name)), name: name, en: '', aliases: [], is_active: true });
    });
    return rows;
  }
  function find(rows, value) {
    return rows.find(function (row) { return [row.name].concat(row.aliases || []).some(function (alias) { return key(alias) === key(value); }); });
  }
  function canonical(rows, value) { var row = find(rows, value); return row ? row.name : String(value || '').trim(); }
  function visible(rows, value) { var row = find(rows, value); return !row || row.is_active !== false; }
  function validate(rows, draft, currentId) {
    if (!draft.name || draft.name.trim().length > 60) return 'Tên danh mục bắt buộc, tối đa 60 ký tự.';
    if (String(draft.en || '').length > 80) return 'Tên tiếng Anh tối đa 80 ký tự.';
    var taken = rows.find(function (row) { return row.id !== currentId && [row.name].concat(row.aliases || []).some(function (name) { return key(name) === key(draft.name); }); });
    return taken ? 'Tên này đã thuộc một danh mục hoặc tên cũ đang sử dụng. Hãy chọn tên khác.' : '';
  }
  window.HOMELODY_CATEGORIES = { key: key, resolve: resolve, find: find, canonical: canonical, visible: visible, validate: validate };
})();
