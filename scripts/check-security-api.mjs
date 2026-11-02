// Read-only checks. Never tests writes/deletes or sends login attempts.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const scope = { window: {} };
vm.runInNewContext(fs.readFileSync('assets/js/config.js', 'utf8'), scope);
const cfg = scope.window.HOMELODY_CONFIG;
assert.ok(cfg.supabaseKey.startsWith('sb_publishable_'));
async function request(path, options = {}) {
  const response = await fetch(cfg.supabaseUrl + path, {
    ...options, headers: { apikey: cfg.supabaseKey, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(12000)
  });
  return { status: response.status, ok: response.ok, data: await response.json() };
}
const active = await request('/rest/v1/drinks?select=id&is_active=eq.true&limit=1');
assert.ok(active.ok && Array.isArray(active.data), 'Public menu remains readable');
const hidden = await request('/rest/v1/drinks?select=id&is_active=eq.false&limit=1');
assert.ok(hidden.ok && Array.isArray(hidden.data) && hidden.data.length === 0, 'Anonymous users must not read hidden products');
const admins = await request('/rest/v1/admin_users?select=email&limit=1');
assert.ok([401, 403, 404].includes(admins.status) || (admins.ok && Array.isArray(admins.data) && admins.data.length === 0), 'Admin allowlist must not be public');
const admin = await request('/rest/v1/rpc/is_admin', { method: 'POST', body: '{}' });
assert.ok(admin.ok && admin.data === false, 'Anonymous caller must not be an admin');
console.log('PASS: public menu readable; hidden products/admin allowlist inaccessible; anonymous admin check returns false.');
const shopLinks = await request('/rest/v1/shop_settings?select=public_links&id=eq.1');
assert.ok(shopLinks.ok && shopLinks.data.length === 1 && typeof shopLinks.data[0].public_links === 'object' && shopLinks.data[0].public_links !== null, 'Public link settings column must be readable');
console.log('PASS: live shop_settings exposes the new public_links field for website reads.');
const categories = await request('/rest/v1/shop_settings?select=menu_categories&id=eq.1');
assert.ok(categories.ok && categories.data.length === 1 && (categories.data[0].menu_categories === null || Array.isArray(categories.data[0].menu_categories)), 'Menu category metadata must be readable');
console.log('PASS: live menu_categories field is available; NULL retains the original category configuration.');
const favorites = await request('/rest/v1/shop_settings?select=featured_drink_ids&id=eq.1');
assert.ok(favorites.ok && favorites.data.length === 1 && (favorites.data[0].featured_drink_ids === null || (Array.isArray(favorites.data[0].featured_drink_ids) && favorites.data[0].featured_drink_ids.length <= 6)), 'Favorites metadata must be available with a six-item cap');
console.log(favorites.data[0].featured_drink_ids === null ? 'PASS: live featured_drink_ids is ready; NULL preserves the existing selection.' : `PASS: live featured_drink_ids contains ${favorites.data[0].featured_drink_ids.length} saved favorites.`);
console.log('Not verified: authenticated policies, write permissions, bucket restrictions, Auth rate limits, hosting firewall.');
