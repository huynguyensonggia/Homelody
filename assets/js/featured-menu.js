/* One selection rule for admin and public landing-page favorites. */
(function () {
  'use strict';
  function limit(value) { return Math.min(6, Math.max(1, Math.floor(Number(value) || 6))); }
  function eligible(drink, categories) {
    return !!drink && drink.is_active !== false && !!(drink.image_url || drink.image) &&
      (!window.HOMELODY_CATEGORIES || window.HOMELODY_CATEGORIES.visible(categories || [], drink.category));
  }
  function configuredIds(shop, drinks, categories, maximum) {
    var saved = shop && (shop.featured_drink_ids !== undefined ? shop.featured_drink_ids : shop.featuredDrinkIds);
    if (Array.isArray(saved)) return Array.from(new Set(saved.filter(function (id) { return typeof id === 'string' && id; }))).slice(0, limit(maximum));
    var available = drinks.filter(function (drink) { return eligible(drink, categories); });
    var starred = available.filter(function (drink) { return drink.is_featured || drink.featured; }).slice(0, limit(maximum));
    return (starred.length ? starred : available.slice(0, Math.min(4, limit(maximum)))).map(function (drink) { return String(drink.id); });
  }
  function resolve(shop, drinks, categories, maximum) {
    var byId = new Map(drinks.map(function (drink) { return [String(drink.id), drink]; }));
    return configuredIds(shop, drinks, categories, maximum).map(function (id) { return byId.get(id); }).filter(function (drink) { return eligible(drink, categories); });
  }
  window.HOMELODY_FEATURED_MENU = { limit: limit, eligible: eligible, configuredIds: configuredIds, resolve: resolve };
})();
