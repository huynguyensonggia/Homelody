/* HOMELODY — trang quản lý thực đơn
 * Có Supabase (config.js)  → đăng nhập thật, ghi vào database + kho ảnh.
 * Chưa có                  → "chế độ xem thử": lưu vào localStorage của trình duyệt này,
 *                            trang web chính (cùng trình duyệt) sẽ đọc lại để xem trước.
 */
import { buildImportPreview, readDrinkSheet } from './drink-import.mjs?v=20261023import';
const CFG = window.HOMELODY_CONFIG || {};
const FALLBACK = window.HOMELODY_FALLBACK || { drinks: [], shop: {} };
const DEMO_KEY = 'homelody:admin-demo';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.116.0/+esm';
const BUCKET = CFG.imageBucket || 'menu-images';
const FAVORITES = window.HOMELODY_FEATURED_MENU;
const MAX_FEATURED = FAVORITES.limit(CFG.maxFeatured);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
const configured = /^https:\/\/\S+$/.test((CFG.supabaseUrl || '').trim()) && (CFG.supabaseKey || '').trim().length > 20;
const localPreview = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/* Images saved by the site use paths relative to the site root; the admin lives one folder down. */
function viewSrc(url) {
  if (!url) return '';
  return /^(https?:|data:|blob:|\/)/i.test(url) ? url : '../' + url;
}

/* ======================================================================== API: Supabase */
async function supabaseApi() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(CFG.supabaseUrl.trim(), CFG.supabaseKey.trim(), {
    auth: { storage: sessionStorage, detectSessionInUrl: false }
  });
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    demo: false,
    async session() {
      const { data, error } = await sb.auth.getUser();
      return !error && data.user ? { email: data.user.email } : null;
    },
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Sai email hoặc mật khẩu.' : error.message);
      return { email: data.user.email };
    },
    async isAdmin() {
      const { data, error } = await sb.rpc('is_admin');
      if (error) throw error;
      return data === true;
    },
    async signOut() { await sb.auth.signOut(); },
    async listDrinks() {
      const rows = must(await sb.from('drinks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }));
      this.bilingual = rows.length ? Object.prototype.hasOwnProperty.call(rows[0], 'name_en') : !(await sb.from('drinks').select('name_en').limit(0)).error;
      return rows;
    },
    async saveDrink(row) {
      const { id, created_at, updated_at, ...fields } = row;
      if (id) return must(await sb.from('drinks').update(fields).eq('id', id).select().single());
      return must(await sb.from('drinks').insert(fields).select().single());
    },
    async deleteDrink(row) {
      must(await sb.from('drinks').delete().eq('id', row.id));
      await this.removeImage(row.image_url);
    },
    async countDrinks() {
      const result = await sb.from('drinks').select('id', { count: 'exact', head: true });
      must(result); return result.count;
    },
    async deleteAllDrinks() {
      if (!(await this.isAdmin())) throw new Error('Tài khoản này chưa có quyền xóa sản phẩm.');
      const result = await sb.from('drinks').delete({ count: 'exact' }).not('id', 'is', null);
      must(result); return result.count;
    },
    async importDrinks(rows) {
      return must(await sb.from('drinks').insert(rows).select());
    },
    async setOrder(rows) {
      // only the rows whose position changed
      for (const r of rows) must(await sb.from('drinks').update({ sort_order: r.sort_order }).eq('id', r.id));
    },
    async uploadImage(blob, baseName, folder = 'drinks') {
      if (!['image/webp', 'image/png', 'image/jpeg'].includes(blob.type) || blob.size > 3 * 1024 * 1024) {
        throw new Error('Chỉ nhận ảnh WebP, PNG, JPG tối đa 3MB.');
      }
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      const path = `${folder}/${crypto.randomUUID()}-${slug(baseName) || 'anh'}.${ext}`;
      must(await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false }));
      return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    },
    async removeImage(url) {
      const marker = `/storage/v1/object/public/${BUCKET}/`;
      if (!url || url.indexOf(marker) < 0) return;      // only files we uploaded
      const path = decodeURIComponent(url.split(marker)[1].split('?')[0]);
      await sb.storage.from(BUCKET).remove([path]).catch(() => {});
    },
    async getShop() {
      const rows = must(await sb.from('shop_settings').select('*').eq('id', 1));
      return rows[0] || {};
    },
    async saveShop(values) {
      return must(await sb.from('shop_settings').update(values).eq('id', 1).select().single());
    },
    async saveCategories(categories, version) {
      const result = must(await sb.from('shop_settings').update({ menu_categories: categories }).eq('id', 1).eq('updated_at', version).select().maybeSingle());
      if (!result) throw new Error('Thông tin quán vừa thay đổi. Bấm “Tải lại” danh mục rồi thử lại.');
      return result;
    },
    async saveFavorites(ids, version) {
      const result = must(await sb.from('shop_settings').update({ featured_drink_ids: ids }).eq('id', 1).eq('updated_at', version).select().maybeSingle());
      if (!result) throw new Error('Thông tin quán vừa thay đổi. Đóng rồi mở lại mục chọn món để tải dữ liệu mới.');
      return result;
    }
  };
}

/* ======================================================================== API: demo (localStorage) */
function demoApi() {
  const read = () => {
    try { const s = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); if (s && Array.isArray(s.drinks)) return s; } catch {}
    const shop = FALLBACK.shop || {}, so = shop.social || {};
    return {
      drinks: (FALLBACK.drinks || []).map((d, i) => ({
        id: 'demo-' + (i + 1), name: d.name, category: d.category || 'Cà phê Việt', price: d.price, description: d.description || '',
        note: d.note || '', ingredients: d.ingredients || [], image_url: d.image || '', image_alt: d.alt || '',
        is_active: true, is_featured: !!d.featured, sort_order: (i + 1) * 10
      })),
      shop: {
        address: shop.address || '', hours: shop.hours || '', phone: shop.phone || '',
        directions_url: shop.directionsUrl || '', contact_url: shop.contactUrl || '',
        facebook_url: so.Facebook || '', instagram_url: so.Instagram || '', tiktok_url: so.TikTok || ''
      }
    };
  };
  const write = (s) => {
    try { localStorage.setItem(DEMO_KEY, JSON.stringify(s)); }
    catch { throw new Error('Bộ nhớ trình duyệt đã đầy (ảnh quá nhiều). Kết nối Supabase để lưu thật.'); }
  };
  let state = read();
  const SESSION = 'homelody:admin-demo-session';
  return {
    demo: true,
    async session() { const e = sessionStorage.getItem(SESSION); return e ? { email: e } : null; },
    async signIn(email) { sessionStorage.setItem(SESSION, email || 'demo'); return { email: email || 'demo' }; },
    async isAdmin() { return true; },
    async signOut() { sessionStorage.removeItem(SESSION); },
    async listDrinks() { state = read(); return structuredClone(state.drinks).sort((a, b) => a.sort_order - b.sort_order); },
    async saveDrink(row) {
      const copy = structuredClone(row);
      if (!copy.id) { copy.id = 'demo-' + Date.now(); state.drinks.push(copy); }
      else state.drinks = state.drinks.map((d) => (d.id === copy.id ? copy : d));
      write(state); return copy;
    },
    async deleteDrink(row) { state.drinks = state.drinks.filter((d) => d.id !== row.id); write(state); },
    async countDrinks() { return read().drinks.length; },
    async deleteAllDrinks() {
      const current = read(), count = current.drinks.length;
      const next = { ...current, drinks: [] };
      write(next); state = next; return count;
    },
    async importDrinks(rows) {
      const added = rows.map((row) => ({ ...structuredClone(row), id: 'demo-' + crypto.randomUUID() }));
      const next = { ...state, drinks: [...state.drinks, ...added] };
      write(next); state = next; return structuredClone(added);
    },
    async setOrder(rows) {
      const map = new Map(rows.map((r) => [r.id, r.sort_order]));
      state.drinks.forEach((d) => { if (map.has(d.id)) d.sort_order = map.get(d.id); });
      write(state);
    },
    async uploadImage(blob) {
      return await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
    },
    async removeImage() {},
    async getShop() { state = read(); return structuredClone(state.shop); },
    async saveShop(values) {
      state = read();
      const next = { ...state, shop: { ...state.shop, ...values, updated_at: new Date().toISOString() } };
      write(next); state = next; return structuredClone(state.shop);
    },
    async saveCategories(categories, version) {
      state = read();
      if ((state.shop.updated_at || null) !== version) throw new Error('Thông tin quán vừa thay đổi. Bấm “Tải lại” danh mục rồi thử lại.');
      return this.saveShop({ menu_categories: categories });
    },
    async saveFavorites(ids, version) {
      state = read();
      if ((state.shop.updated_at || null) !== version) throw new Error('Thông tin quán vừa thay đổi. Đóng rồi mở lại mục chọn món để tải dữ liệu mới.');
      return this.saveShop({ featured_drink_ids: ids });
    }
  };
}

/* ======================================================================== image prep */
function slug(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
}
/* Trim transparent margins so the glass base is the bottom edge, cap the size, encode WebP (PNG fallback). */
async function prepareImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Không đọc được ảnh này.')); i.src = url; });
    const w = img.naturalWidth, h = img.naturalHeight;
    if (!w || !h || w * h > 24000000 || Math.max(w, h) > 10000) throw new Error('Ảnh quá lớn. Chọn ảnh tối đa 24 megapixel và 10.000px mỗi cạnh.');
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, w, h).data;
    let minX = w, minY = h, maxX = -1, maxY = -1, clear = 0;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const a = px[(y * w + x) * 4 + 3];
        if (a < 250) clear += 1;
        if (a > 12) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    const transparent = clear > w * h * 0.04;
    let sx = 0, sy = 0, sw = w, sh = h;
    if (transparent && maxX >= 0) { sx = minX; sy = minY; sw = maxX - minX + 1; sh = maxY - minY + 1; }
    const scale = Math.min(1, 900 / sh, 900 / sw);
    const out = document.createElement('canvas');
    out.width = Math.round(sw * scale); out.height = Math.round(sh * scale);
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.drawImage(c, sx, sy, sw, sh, 0, 0, out.width, out.height);
    let blob = await new Promise((res) => out.toBlob(res, 'image/webp', 0.86));
    if (!blob || blob.type !== 'image/webp') blob = await new Promise((res) => out.toBlob(res, 'image/png'));
    return { blob, transparent, width: out.width, height: out.height };
  } finally { URL.revokeObjectURL(url); }
}

/* ======================================================================== UI helpers */
let toastTimer;
function toast(msg, isError) {
  const t = $('#toast');
  t.textContent = msg; t.classList.toggle('is-error', !!isError); t.classList.add('is-show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('is-show'), isError ? 5200 : 2600);
}
function errText(e) {
  const m = (e && (e.message || e.error_description)) || String(e);
  if (/row-level security|permission denied|not authorized/i.test(m)) return 'Tài khoản này chưa có quyền sửa menu (thêm email vào bảng admin_users).';
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Mất kết nối mạng, thử lại sau.';
  if (/JWT expired|session/i.test(m)) return 'Phiên đăng nhập đã hết, hãy đăng nhập lại.';
  return m;
}
async function busy(btn, fn, message = 'Đang lưu…') {
  const label = btn.innerHTML; btn.disabled = true; btn.textContent = message; btn.setAttribute('aria-busy', 'true');
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = label; btn.removeAttribute('aria-busy'); }
}
function parsePrice(v) {
  const s = String(v || '').trim().toLowerCase().replace(/\s/g, '');
  if (!s) return NaN;
  const k = /k$/.test(s);
  let n = Number(s.replace(/[^\d]/g, ''));
  if (!n && n !== 0) return NaN;
  if (k || (n > 0 && n < 1000)) n *= 1000;   // "45" or "45k" → 45.000đ
  return n;
}

/* ======================================================================== app */
let api, drinks = [], editing = null, pendingImage = null, removeImageFlag = false;

async function boot() {
  if (!configured && !localPreview) {
    showLogin('Chưa cấu hình kết nối quản trị. Chế độ demo chỉ dùng trên máy cục bộ.');
    $('#login-form button[type=submit]').disabled = true;
    return;
  }
  $$('[data-demo-only]').forEach((el) => { el.hidden = configured; });
  try { api = configured ? await supabaseApi() : demoApi(); }
  catch (e) { showLogin('Không tải được thư viện Supabase. Kiểm tra mạng rồi tải lại trang.'); return; }
  const s = await api.session().catch(() => null);
  if (s) {
    try {
      if (!(await api.isAdmin())) { await api.signOut(); showLogin('Tài khoản này chưa có quyền quản trị.'); return; }
      enterApp(s);
    } catch (e) { showLogin('Không kiểm tra được quyền quản trị: ' + errText(e)); }
  } else showLogin();
}

function showLogin(msg) {
  $('#app').hidden = true; $('#login').hidden = false;
  const err = $('#login-error'); err.hidden = !msg; err.textContent = msg || '';
  $('#login-form [name=email]').focus();
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!api) return;
  const f = e.currentTarget, btn = $('button[type=submit]', f), err = $('#login-error');
  err.hidden = true;
  const email = f.email.value.trim(), password = f.password.value;
  if (!api.demo && (!email || !password)) { err.textContent = 'Nhập email và mật khẩu.'; err.hidden = false; return; }
  btn.disabled = true;
  try {
    const s = await api.signIn(email, password);
    if (!(await api.isAdmin())) { await api.signOut(); throw new Error('Tài khoản này chưa có quyền sửa menu. Thêm email vào bảng admin_users trong Supabase.'); }
    f.reset(); enterApp(s);
  } catch (ex) { err.textContent = errText(ex); err.hidden = false; }
  finally { btn.disabled = false; }
});

async function enterApp(s) {
  $('#login').hidden = true; $('#app').hidden = false;
  $('#user-email').textContent = s.email;
  $('#connection-state').textContent = api.demo ? 'Bản xem thử' : 'Dữ liệu trực tiếp';
  await loadManagedCategories();
  await Promise.all([loadDrinks(), loadShop(), storyManager.load(), spaceManager.load()]);
}

$('#logout').addEventListener('click', async () => { await api.signOut(); location.reload(); });

/* tabs */
const compactNavigation = matchMedia('(max-width: 767px)');
function updateTabOrientation() { $('.tabs').setAttribute('aria-orientation', compactNavigation.matches ? 'horizontal' : 'vertical'); }
compactNavigation.addEventListener('change', updateTabOrientation);
updateTabOrientation();
$$('.tab').forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
$('.tabs').addEventListener('keydown', (e) => {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
  e.preventDefault();
  const tabs = $$('.tab'), i = tabs.indexOf(document.activeElement);
  const next = e.key === 'Home' ? tabs[0] : e.key === 'End' ? tabs[tabs.length - 1] : tabs[(i + (['ArrowRight', 'ArrowDown'].includes(e.key) ? 1 : -1) + tabs.length) % tabs.length];
  selectTab(next); next.focus();
});
function selectTab(tab) {
  $('#workspace-current').textContent = $('span', tab).textContent;
  window.scrollTo({ top: 0, behavior: 'instant' });
  $$('.tab').forEach((t) => {
    const on = t === tab;
    t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
}

/* ---------- managed categories; the original configuration remains the initial fallback */
const CATEGORY_SETTINGS = window.HOMELODY_CATEGORIES;
let CATS = CATEGORY_SETTINGS.resolve({});
let categoryReady = false, categoryVersion = null, categoryWorking = false, editingCategory = null, deletingCategory = null;
let favoritesSavedIds = null, favoritesVersion = null, favoritesReady = false, favoritesWorking = false, favoritesDraft = [], favoritesInitial = '';
function adoptFavoritesShop(shop) {
  favoritesSavedIds = Array.isArray(shop.featured_drink_ids) ? [...shop.featured_drink_ids] : null;
  favoritesVersion = shop.updated_at || null;
  favoritesReady = api.demo || Object.prototype.hasOwnProperty.call(shop, 'featured_drink_ids');
}
function currentFavorites() { return FAVORITES.resolve({ featured_drink_ids: favoritesSavedIds }, drinks, CATS, MAX_FEATURED); }
function renderFavoritesPreview() {
  const selected = currentFavorites();
  $('#manage-favorites').disabled = !favoritesReady || favoritesWorking;
  $('#favorites-summary').textContent = `${selected.length} / ${MAX_FEATURED} món đang xuất hiện · Theo đúng thứ tự bên dưới`;
  $('#favorites-preview').innerHTML = selected.map((drink, index) => `<figure><span class="favorite-position">${String(index + 1).padStart(2, '0')}</span><img src="${esc(viewSrc(drink.image_url || drink.image))}" alt=""><figcaption>${esc(drink.name)}<small>${money(drink.price)}</small></figcaption></figure>`).join('') || '<p class="empty">Chưa có món đủ điều kiện hiển thị. Chọn món đang bán và có ảnh.</p>';
  const configured = FAVORITES.configuredIds({ featured_drink_ids: favoritesSavedIds }, drinks, CATS, MAX_FEATURED);
  const missing = configured.length - selected.length;
  $('#favorites-note').textContent = missing > 0 ? `${missing} món đã chọn đang ẩn, thiếu ảnh hoặc đã bị xóa. Mở “Chọn & sắp xếp” để kiểm tra.` : `Tối đa ${MAX_FEATURED} món. Chỉ hiển thị món đang bán, có ảnh và thuộc danh mục đang bật.`;
}
const favoritesEditor = $('#favorites-editor'), favoritesDiscard = $('#favorites-discard');
function favoriteReason(drink) {
  if (!drink) return 'Món đã bị xóa';
  if (!drink.is_active) return 'Món đang ẩn';
  if (!CATEGORY_SETTINGS.visible(CATS, drink.category)) return 'Danh mục đang ẩn';
  if (!(drink.image_url || drink.image)) return 'Chưa có ảnh';
  return '';
}
function renderFavoritesDialog() {
  const selected = favoritesDraft.map(id => drinks.find(drink => String(drink.id) === id));
  const invalid = selected.filter(drink => !FAVORITES.eligible(drink, CATS)).length;
  $('#favorites-count').textContent = `${favoritesDraft.length} / ${MAX_FEATURED}`;
  $('#favorites-selected').innerHTML = selected.map((drink, index) => `<li class="favorite-selected${favoriteReason(drink) ? ' is-unavailable' : ''}">
    <span class="favorite-position">${index + 1}</span>
    ${drink?.image_url ? `<img src="${esc(viewSrc(drink.image_url))}" alt="">` : '<span class="favorite-no-image" aria-hidden="true">—</span>'}
    <div><strong>${esc(drink?.name || 'Món không còn trong thực đơn')}</strong><small>${esc(favoriteReason(drink) || money(drink.price))}</small></div>
    <div class="favorite-selected__actions"><button class="icon-btn" type="button" data-favorite-up="${index}" aria-label="Đưa món ${index + 1} lên" ${favoritesWorking || index === 0 ? 'disabled' : ''}>↑</button><button class="icon-btn" type="button" data-favorite-down="${index}" aria-label="Đưa món ${index + 1} xuống" ${favoritesWorking || index === selected.length - 1 ? 'disabled' : ''}>↓</button><button class="icon-btn" type="button" data-favorite-remove="${index}" aria-label="Bỏ ${esc(drink?.name || 'món đã xóa')} khỏi món yêu thích" ${favoritesWorking ? 'disabled' : ''}>×</button></div>
  </li>`).join('') || '<li class="empty">Chọn món từ danh sách bên cạnh để bắt đầu.</li>';
  const query = searchKey($('#favorites-search').value);
  const options = drinks.filter(drink => !query || searchKey(drink.name + ' ' + canonicalCat(drink.category)).includes(query));
  $('#favorites-options').innerHTML = options.map(drink => {
    const checked = favoritesDraft.includes(String(drink.id)), reason = favoriteReason(drink);
    return `<label class="favorite-option${reason ? ' is-unavailable' : ''}"><input type="checkbox" data-favorite-pick value="${esc(drink.id)}" ${checked ? 'checked' : ''} ${favoritesWorking || (!checked && (reason || favoritesDraft.length >= MAX_FEATURED)) ? 'disabled' : ''}><span><strong>${esc(drink.name)}</strong><small>${esc(reason || canonicalCat(drink.category) + ' · ' + money(drink.price))}</small></span></label>`;
  }).join('') || '<p class="empty">Không có món khớp từ khóa. Thử tên hoặc danh mục khác.</p>';
  $('#favorites-status').textContent = favoritesWorking ? 'Đang lưu lựa chọn…' : invalid ? `${invalid} món chưa đủ điều kiện. Bỏ món đó hoặc cập nhật ảnh/trạng thái trước khi lưu.` : favoritesDraft.length === MAX_FEATURED ? `Đã đủ ${MAX_FEATURED} món. Bỏ một món để chọn món khác.` : `Chọn từ 1 đến ${MAX_FEATURED} món. Thay đổi chỉ áp dụng khi bấm lưu.`;
  $('#save-favorites').disabled = favoritesWorking || !favoritesDraft.length || !!invalid;
}
$('#manage-favorites').addEventListener('click', async event => {
  if (favoritesWorking) return;
  favoritesWorking = true;
  await busy(event.currentTarget, async () => {
    try {
      const [shop, rows] = await Promise.all([api.getShop(), api.listDrinks()]);
      adoptFavoritesShop(shop);
      if (!favoritesReady) throw new Error('Bộ lưu món yêu thích chưa sẵn sàng. Vui lòng tải lại trang sau khi cập nhật hệ thống.');
      drinks = rows; CATS = CATEGORY_SETTINGS.resolve(shop, drinks); categoryVersion = shop.updated_at || null;
      favoritesDraft = FAVORITES.configuredIds(shop, drinks, CATS, MAX_FEATURED); favoritesInitial = JSON.stringify(favoritesDraft);
      $('#favorites-search').value = ''; $('#favorites-error').hidden = true;
      favoritesWorking = false; syncCategoryFilter(); renderList(); renderFavoritesDialog();
      favoritesEditor.showModal();
    } catch (error) { toast(errText(error), true); }
    finally { favoritesWorking = false; }
  }, 'Đang tải…');
  renderFavoritesPreview();
});
$('#favorites-search').addEventListener('input', renderFavoritesDialog);
$('#favorites-options').addEventListener('change', event => {
  if (!event.target.matches('[data-favorite-pick]') || favoritesWorking) return;
  const id = event.target.value;
  if (event.target.checked) {
    const drink = drinks.find(item => String(item.id) === id);
    if (favoritesDraft.length < MAX_FEATURED && FAVORITES.eligible(drink, CATS) && !favoritesDraft.includes(id)) favoritesDraft.push(id);
  } else favoritesDraft = favoritesDraft.filter(value => value !== id);
  renderFavoritesDialog();
  $(`[data-favorite-pick][value="${CSS.escape(id)}"]`)?.focus();
});
$('#favorites-selected').addEventListener('click', event => {
  if (favoritesWorking) return;
  const remove = event.target.closest('[data-favorite-remove]');
  if (remove) {
    const index = Number(remove.dataset.favoriteRemove); favoritesDraft.splice(index, 1); renderFavoritesDialog();
    const target = $(`[data-favorite-remove="${Math.min(index, favoritesDraft.length - 1)}"]`) || $('#favorites-search'); target.focus(); return;
  }
  const button = event.target.closest('[data-favorite-up], [data-favorite-down]'); if (!button) return;
  const index = Number(button.dataset.favoriteUp ?? button.dataset.favoriteDown), next = index + (button.hasAttribute('data-favorite-up') ? -1 : 1);
  if (next >= 0 && next < favoritesDraft.length) [favoritesDraft[index], favoritesDraft[next]] = [favoritesDraft[next], favoritesDraft[index]];
  renderFavoritesDialog();
  const direction = button.hasAttribute('data-favorite-up') ? 'up' : 'down';
  const focusButton = $(`[data-favorite-${direction}="${next}"]:not([disabled])`) || $(`[data-favorite-remove="${next}"]`);
  focusButton?.focus();
});
function requestFavoritesClose() {
  if (favoritesWorking) return;
  if (JSON.stringify(favoritesDraft) !== favoritesInitial) favoritesDiscard.showModal(); else favoritesEditor.close();
}
$$('[data-favorites-close]').forEach(button => button.addEventListener('click', requestFavoritesClose));
favoritesEditor.addEventListener('cancel', event => { event.preventDefault(); requestFavoritesClose(); });
$('#favorites-continue').addEventListener('click', () => favoritesDiscard.close());
$('#favorites-discard-confirm').addEventListener('click', () => { favoritesDiscard.close(); favoritesEditor.close(); });
$('#favorites-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (favoritesWorking || !favoritesDraft.length || favoritesDraft.length > MAX_FEATURED) return;
  $('#favorites-error').hidden = true;
  await busy($('#save-favorites'), async () => {
    favoritesWorking = true; renderFavoritesDialog();
    try {
      const [shop, rows] = await Promise.all([api.getShop(), api.listDrinks()]);
      if ((shop.updated_at || null) !== favoritesVersion) throw new Error('Thông tin quán vừa thay đổi. Đóng rồi mở lại mục chọn món để tải dữ liệu mới.');
      drinks = rows; CATS = CATEGORY_SETTINGS.resolve(shop, drinks);
      if (favoritesDraft.some(id => !FAVORITES.eligible(rows.find(drink => String(drink.id) === id), CATS))) throw new Error('Một số món vừa bị ẩn, xóa hoặc thiếu ảnh. Kiểm tra lại các món được chọn.');
      const saved = await api.saveFavorites([...favoritesDraft], favoritesVersion);
      adoptFavoritesShop(saved); CATS = CATEGORY_SETTINGS.resolve(saved, drinks); categoryVersion = saved.updated_at || null;
      try { localStorage.removeItem('homelody:menu:v1'); } catch (_) { /* optional cache */ }
      favoritesEditor.close(); syncCategoryFilter(); renderList(); toast('Đã lưu món yêu thích và thứ tự hiển thị');
    } catch (error) { $('#favorites-error').textContent = errText(error); $('#favorites-error').hidden = false; }
    finally { favoritesWorking = false; }
  });
  renderFavoritesDialog(); renderList();
});
function canonicalCat(v) {
  return CATEGORY_SETTINGS.canonical(CATS, v);
}
function publishedDrink(drink) { return drink.is_active && CATEGORY_SETTINGS.visible(CATS, drink.category); }

async function loadManagedCategories() {
  $('#category-list').setAttribute('aria-busy', 'true');
  $('#category-error').hidden = true;
  try {
    const shop = await api.getShop();
    adoptFavoritesShop(shop);
    CATS = CATEGORY_SETTINGS.resolve(shop, drinks);
    categoryVersion = shop.updated_at || null;
    categoryReady = api.demo || Object.prototype.hasOwnProperty.call(shop, 'menu_categories');
    if (!categoryReady) throw new Error('Bộ lưu danh mục chưa sẵn sàng. Vui lòng tải lại sau khi cập nhật hệ thống.');
  } catch (error) {
    categoryReady = false; $('#category-error').textContent = errText(error); $('#category-error').hidden = false;
  } finally { renderCategories(); $('#category-list').setAttribute('aria-busy', 'false'); }
}
function categoryCount(category) { return drinks.filter(drink => canonicalCat(drink.category) === category.name).length; }
function renderCategories() {
  const disabled = !categoryReady || categoryWorking;
  $('#add-category').disabled = disabled;
  $('#refresh-categories').disabled = categoryWorking;
  $('#category-summary').textContent = `${CATS.length} danh mục · ${CATS.filter(category => category.is_active).length} đang bật`;
  $('#category-list').innerHTML = CATS.length ? CATS.map((category, index) => {
    const count = categoryCount(category);
    return `<article class="category-row" data-category-id="${esc(category.id)}">
      <span class="category-row__order">${String(index + 1).padStart(2, '0')}</span>
      <div class="category-row__name"><h3>${esc(category.name)}</h3><p>${category.en ? esc(category.en) + ' · ' : ''}${count} món${!category.is_active ? ' · Đang ẩn trên website' : ''}</p></div>
      <button class="btn btn--ghost btn--sm" type="button" data-category-items ${!count ? 'disabled' : ''}>Xem món</button>
      <div class="category-row__actions">
        <button class="icon-btn" type="button" data-category-move="-1" aria-label="Đưa ${esc(category.name)} lên" ${disabled || !index ? 'disabled' : ''}>↑</button>
        <button class="icon-btn" type="button" data-category-move="1" aria-label="Đưa ${esc(category.name)} xuống" ${disabled || index === CATS.length - 1 ? 'disabled' : ''}>↓</button>
        <label class="switch switch--inline"><input type="checkbox" data-category-active ${category.is_active ? 'checked' : ''} ${disabled ? 'disabled' : ''} aria-label="Hiển thị danh mục ${esc(category.name)}"><span class="switch__ui"></span></label>
        <button class="btn btn--ghost btn--sm" type="button" data-category-edit ${disabled ? 'disabled' : ''}>Sửa</button>
        <button class="btn btn--danger-ghost btn--sm" type="button" data-category-delete ${disabled || count ? 'disabled' : ''} title="${count ? 'Chuyển các món sang danh mục khác trước khi xóa' : 'Xóa danh mục trống'}">Xóa</button>
      </div>
    </article>`;
  }).join('') : '<div class="empty"><h3>Chưa có danh mục</h3><p>Thêm nhóm đầu tiên để bắt đầu sắp xếp thực đơn.</p></div>';
}
async function persistCategories(next) {
  if (!categoryReady || categoryWorking) throw new Error('Vui lòng chờ danh mục tải xong.');
  categoryWorking = true; $('#category-error').hidden = true; $('#category-list').setAttribute('aria-busy', 'true'); renderCategories();
  try {
    const saved = await api.saveCategories(next, categoryVersion);
    adoptFavoritesShop(saved);
    CATS = CATEGORY_SETTINGS.resolve(saved, drinks); categoryVersion = saved.updated_at || null;
    syncCategoryFilter(); renderList();
    try { localStorage.removeItem('homelody:menu:v1'); } catch (_) { /* optional cache */ }
  } finally { categoryWorking = false; renderCategories(); $('#category-list').setAttribute('aria-busy', 'false'); }
}
$('#refresh-categories').addEventListener('click', async () => { await loadManagedCategories(); await loadDrinks(); });
const categoryEditor = $('#category-editor'), categoryForm = $('#category-form');
function openCategoryEditor(category) {
  editingCategory = category; categoryForm.reset(); $('#category-form-error').hidden = true;
  $('#category-editor-title').textContent = category ? 'Sửa danh mục' : 'Thêm danh mục';
  categoryForm.elements.namedItem('name').value = category?.name || '';
  categoryForm.elements.namedItem('en').value = category?.en || '';
  categoryForm.elements.namedItem('is_active').checked = category?.is_active !== false;
  categoryEditor.showModal(); categoryForm.elements.namedItem('name').focus();
}
$('#add-category').addEventListener('click', () => openCategoryEditor(null));
$$('[data-category-close]').forEach(button => button.addEventListener('click', () => { if (!categoryWorking) categoryEditor.close(); }));
categoryEditor.addEventListener('cancel', event => { if (categoryWorking) event.preventDefault(); });
categoryForm.addEventListener('submit', async event => {
  event.preventDefault(); if (categoryWorking) return;
  const draft = { id: editingCategory?.id || crypto.randomUUID(), name: categoryForm.elements.namedItem('name').value.trim(), en: categoryForm.elements.namedItem('en').value.trim(), is_active: categoryForm.elements.namedItem('is_active').checked, aliases: [...(editingCategory?.aliases || [])] };
  const error = $('#category-form-error'), issue = CATEGORY_SETTINGS.validate(CATS, draft, editingCategory?.id);
  error.hidden = true;
  if (issue) { error.textContent = issue; error.hidden = false; categoryForm.elements.namedItem('name').focus(); return; }
  if (editingCategory && editingCategory.name !== draft.name) draft.aliases.push(editingCategory.name);
  draft.aliases = [...new Set(draft.aliases)].filter(alias => CATEGORY_SETTINGS.key(alias) !== CATEGORY_SETTINGS.key(draft.name));
  const next = editingCategory ? CATS.map(category => category.id === editingCategory.id ? draft : category) : [...CATS, draft];
  await busy($('#save-category'), async () => {
    try { await persistCategories(next); categoryEditor.close(); toast('Đã lưu danh mục'); }
    catch (ex) { error.textContent = errText(ex); error.hidden = false; }
  });
});
$('#category-list').addEventListener('click', async event => {
  const row = event.target.closest('[data-category-id]'); if (!row || categoryWorking) return;
  const category = CATS.find(item => item.id === row.dataset.categoryId); if (!category) return;
  if (event.target.closest('[data-category-items]')) {
    selectTab($('#tab-menu')); $('#search').value = ''; $('#filter-status').value = 'all'; $('#filter-category').value = category.name; renderList(); return;
  }
  if (event.target.closest('[data-category-edit]')) { openCategoryEditor(category); return; }
  if (event.target.closest('[data-category-delete]') && !categoryCount(category)) {
    deletingCategory = category; $('#category-delete-message').textContent = `Xóa danh mục “${category.name}”? Danh mục này chưa có món.`;
    $('#category-delete-error').hidden = true; $('#category-delete-dialog').showModal(); return;
  }
  const moveButton = event.target.closest('[data-category-move]');
  if (moveButton) {
    const next = [...CATS], index = CATS.indexOf(category), target = index + Number(moveButton.dataset.categoryMove);
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    try { await persistCategories(next); toast('Đã đổi thứ tự danh mục'); }
    catch (ex) { $('#category-error').textContent = errText(ex); $('#category-error').hidden = false; }
  }
});
$('#category-list').addEventListener('change', async event => {
  if (!event.target.matches('[data-category-active]') || categoryWorking) return;
  const id = event.target.closest('[data-category-id]').dataset.categoryId;
  const next = CATS.map(category => category.id === id ? { ...category, is_active: event.target.checked } : category);
  try { await persistCategories(next); toast('Đã cập nhật hiển thị danh mục'); }
  catch (ex) { renderCategories(); $('#category-error').textContent = errText(ex); $('#category-error').hidden = false; }
});
$('#cancel-delete-category').addEventListener('click', () => { if (!categoryWorking) $('#category-delete-dialog').close(); });
$('#confirm-delete-category').addEventListener('click', async event => {
  if (!deletingCategory || categoryWorking) return;
  await busy(event.currentTarget, async () => {
    try {
      drinks = await api.listDrinks();
      if (categoryCount(deletingCategory)) throw new Error('Danh mục đã có món. Hãy chuyển các món sang nhóm khác trước khi xóa.');
      await persistCategories(CATS.filter(category => category.id !== deletingCategory.id));
      $('#category-delete-dialog').close(); toast('Đã xóa danh mục trống');
    } catch (ex) { $('#category-delete-error').textContent = errText(ex); $('#category-delete-error').hidden = false; }
  });
});

/* ---------- drinks list */
async function loadDrinks() {
  $('#drink-list').setAttribute('aria-busy', 'true');
  try { drinks = await api.listDrinks(); CATS = CATEGORY_SETTINGS.resolve({ menu_categories: CATS }, drinks); syncCategoryFilter(); renderList(); renderCategories(); }
  catch (e) {
    $('#list-summary').textContent = 'Chưa tải được dữ liệu. Bấm Tải lại để thử lại.';
    $('#drink-list').innerHTML = `<p class="empty" role="alert">Không tải được danh sách món: ${esc(errText(e))}</p>`;
  } finally { $('#drink-list').setAttribute('aria-busy', 'false'); }
}
const searchKey = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
function syncCategoryFilter() {
  const select = $('#filter-category'), selected = select.value;
  const names = [...new Set([...CATS.map(c => c.name), ...drinks.map(d => canonicalCat(d.category)).filter(Boolean)])];
  select.innerHTML = '<option value="">Tất cả</option>' + names.map(name => `<option value="${esc(name)}">${esc(name)}</option>`).join('');
  select.value = names.includes(selected) ? selected : '';
}
function renderList() {
  renderCategories();
  renderFavoritesPreview();
  const favoriteIds = new Set(currentFavorites().map(drink => String(drink.id)));
  $('#delete-all-drinks').disabled = !drinks.length;
  const q = searchKey($('#search').value.trim());
  const category = $('#filter-category').value, status = $('#filter-status').value;
  const list = $('#drink-list');
  const shown = drinks.filter((d) => (!q || searchKey(d.name + ' ' + canonicalCat(d.category)).includes(q)) &&
    (!category || canonicalCat(d.category) === category) &&
    (status === 'all' || (status === 'active' && publishedDrink(d)) || (status === 'hidden' && !publishedDrink(d)) ||
      (status === 'featured' && favoriteIds.has(String(d.id))) || (status === 'missing-image' && !d.image_url)));
  const featured = favoriteIds.size;
  $('#metric-total').textContent = drinks.length;
  $('#metric-active').textContent = drinks.filter(publishedDrink).length;
  $('#metric-hidden').textContent = drinks.filter(d => !publishedDrink(d)).length;
  $('#metric-featured').textContent = featured;
  $('#nav-menu-count').textContent = drinks.length;
  $('#list-summary').textContent = `Hiển thị ${shown.length} / ${drinks.length} món`;
  $('#clear-filters').hidden = !q && !category && status === 'all';
  $$('[data-status-filter]').forEach(button => {
    const selected = button.dataset.statusFilter === status;
    button.classList.toggle('is-selected', selected); button.setAttribute('aria-pressed', String(selected));
  });
  $('#featured-hint').textContent = `${drinks.length} món · ${featured} món yêu thích đang hiển thị. Chọn và sắp xếp riêng trong khung phía trên.`;

  if (!shown.length) {
    list.innerHTML = `<div class="empty"><span class="empty__symbol" aria-hidden="true">⌕</span><h3>${drinks.length ? 'Chưa tìm thấy món phù hợp' : 'Thực đơn đang chờ món đầu tiên'}</h3><p>${drinks.length ? 'Thử một tên khác hoặc bỏ bớt điều kiện lọc.' : 'Bấm “Thêm món mới” để bắt đầu chăm chút thực đơn.'}</p>${drinks.length ? '<button class="btn btn--outline btn--sm" type="button" data-clear-filters>Xóa bộ lọc</button>' : ''}</div>`;
    return;
  }
  // nhóm theo tên chuẩn, đúng thứ tự tab trên web; nhóm lạ (chưa khai báo) xếp cuối
  const groups = new Map(CATS.map((c) => [c.name, []]));
  shown.forEach((d) => { const k = canonicalCat(d.category) || 'Khác'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
  [...groups.keys()].forEach((k) => { if (!groups.get(k).length) groups.delete(k); });
  list.innerHTML = [...groups].map(([name, items]) => `
    <section class="group">
      <h3 class="group__title">${esc(name)} <span>${items.length} món</span></h3>
      <div class="group__items">${items.map((d) => {
        const up = neighbour(d, -1) < 0, down = neighbour(d, 1) < 0;
        return `
        <article class="drink${d.is_active ? '' : ' is-off'}" data-id="${esc(d.id)}">
          <div class="drink__thumb">${d.image_url ? `<img src="${esc(viewSrc(d.image_url))}" alt="" loading="lazy">` : '<span>Chưa ảnh</span>'}</div>
          <div class="drink__main">
            <button class="drink__name" type="button" data-edit>${esc(d.name)}</button>
            <p class="drink__description">${esc(d.description || 'Chưa có mô tả ngắn')}</p>
            <p class="drink__meta">${favoriteIds.has(String(d.id)) ? '<span class="badge badge--star">★ Món yêu thích</span>' : ''}${!d.image_url ? '<span class="badge badge--missing">Chưa có ảnh</span>' : ''}${!CATEGORY_SETTINGS.visible(CATS, d.category) ? '<span class="badge badge--off">Danh mục đang ẩn</span>' : ''}</p>
          </div>
          <p class="drink__price">${money(d.price)}</p>
          <span class="drink__status ${publishedDrink(d) ? 'drink__status--active' : ''}"><i class="status-dot ${publishedDrink(d) ? '' : 'status-dot--muted'}"></i>${publishedDrink(d) ? 'Đang hiển thị' : 'Đang ẩn'}</span>
          <div class="drink__actions">
            <button class="icon-btn" type="button" data-move="-1" aria-label="Đưa ${esc(d.name)} lên trên" ${up || q ? 'disabled' : ''}>↑</button>
            <button class="icon-btn" type="button" data-move="1" aria-label="Đưa ${esc(d.name)} xuống dưới" ${down || q ? 'disabled' : ''}>↓</button>
            <label class="switch switch--inline" title="Đang bán / ẩn"><input type="checkbox" data-active ${d.is_active ? 'checked' : ''} aria-label="${esc(d.name)} đang bán"><span class="switch__ui"></span></label>
            <button class="btn btn--ghost btn--sm" type="button" data-edit>Sửa</button>
          </div>
        </article>`;
      }).join('')}</div>
    </section>`).join('');
}
$('#search').addEventListener('input', renderList);
$('#filter-category').addEventListener('change', renderList);
$('#filter-status').addEventListener('change', renderList);
function clearFilters() { $('#search').value = ''; $('#filter-category').value = ''; $('#filter-status').value = 'all'; renderList(); }
$('#clear-filters').addEventListener('click', clearFilters);
$$('[data-status-filter]').forEach(button => button.addEventListener('click', () => {
  $('#filter-status').value = button.dataset.statusFilter; renderList();
}));
$('#refresh-drinks').addEventListener('click', async event => { await busy(event.currentTarget, loadDrinks, 'Đang tải…'); });
$('#toggle-password').addEventListener('click', event => {
  const input = $('#login-password'), show = input.type === 'password';
  input.type = show ? 'text' : 'password'; event.currentTarget.textContent = show ? 'Ẩn' : 'Hiện';
  event.currentTarget.setAttribute('aria-pressed', String(show));
});

$('#drink-list').addEventListener('click', async (e) => {
  if (e.target.closest('[data-clear-filters]')) { clearFilters(); $('#search').focus(); return; }
  const card = e.target.closest('.drink'); if (!card) return;
  const d = drinks.find((x) => String(x.id) === card.dataset.id); if (!d) return;
  if (e.target.closest('[data-edit]')) { openEditor(d); return; }
  const mv = e.target.closest('[data-move]');
  if (mv) { await move(d, Number(mv.dataset.move)); }
});
$('#drink-list').addEventListener('change', async (e) => {
  if (!e.target.matches('[data-active]')) return;
  const card = e.target.closest('.drink');
  const d = drinks.find((x) => String(x.id) === card.dataset.id);
  const was = d.is_active;
  e.target.disabled = true;
  d.is_active = e.target.checked;
  try {
    const saved = await api.saveDrink({ ...d });
    Object.assign(d, saved); renderList();
    toast(d.is_active ? `Đã hiện “${d.name}” trên web` : `Đã ẩn “${d.name}”`);
  } catch (ex) { d.is_active = was; renderList(); toast(errText(ex), true); }
});

function neighbour(d, dir) {
  // ↑/↓ move a drink within its own category (that is how both the list and the website group them)
  const i = drinks.indexOf(d);
  for (let j = i + dir; j >= 0 && j < drinks.length; j += dir) if (canonicalCat(drinks[j].category) === canonicalCat(d.category)) return j;
  return -1;
}
async function move(d, dir) {
  const i = drinks.indexOf(d), j = neighbour(d, dir);
  if (j < 0) return;
  const before = drinks.map((x) => x.sort_order);
  [drinks[i], drinks[j]] = [drinks[j], drinks[i]];
  const changed = [];
  drinks.forEach((x, k) => { const so = (k + 1) * 10; if (x.sort_order !== so) { x.sort_order = so; changed.push({ id: x.id, sort_order: so }); } });
  renderList();
  const el = $(`.drink[data-id="${CSS.escape(String(d.id))}"]`);
  if (el && !matchMedia('(prefers-reduced-motion: reduce)').matches) el.animate([{ transform: `translateY(${dir * 24}px)`, opacity: .6 }, { transform: 'none', opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.22,.7,.2,1)' });
  $(`.drink[data-id="${CSS.escape(String(d.id))}"] [data-move="${dir}"]`)?.focus();
  try { await api.setOrder(changed); }
  catch (ex) { drinks.forEach((x, k) => { x.sort_order = before[k]; }); await loadDrinks(); toast(errText(ex), true); }
}

/* ---------- editor */
const editor = $('#editor'), form = $('#drink-form');
function flavorNotes(input = form.note) {
  return input.value.split(/[·•,;|\n]+/).map(value => value.trim()).filter(Boolean);
}
function validateFlavorNotes() {
  return [form.note, form.note_en].map(input => {
    const valid = input.disabled || flavorNotes(input).length <= 3;
    input.setCustomValidity(valid ? '' : 'Chỉ nhập tối đa 3 hương vị. Vui lòng bỏ bớt hương vị trước khi lưu.');
    return valid;
  }).every(Boolean);
}
form.note.addEventListener('input', validateFlavorNotes);
form.note_en.addEventListener('input', validateFlavorNotes);
const discardEditor = $('#discard-editor');
let editorSnapshot = '';
const currentEditorSnapshot = () => JSON.stringify([...new FormData(form)]);
function requestEditorClose() {
  if (currentEditorSnapshot() !== editorSnapshot || pendingImage || (removeImageFlag && editing?.image_url)) {
    discardEditor.showModal();
  } else editor.close();
}
$('#keep-editing').addEventListener('click', () => discardEditor.close());
$('#discard-changes').addEventListener('click', () => { discardEditor.close(); editor.close(); });
editor.addEventListener('cancel', event => { event.preventDefault(); requestEditorClose(); });
$('#add-drink').addEventListener('click', () => openEditor(null));
$$('[data-close]', editor).forEach((b) => b.addEventListener('click', requestEditorClose));
editor.addEventListener('click', (e) => { if (e.target === editor) requestEditorClose(); });

function openEditor(d) {
  editing = d; pendingImage = null; removeImageFlag = false;
  form.reset();
  $('#editor-title').textContent = d ? 'Sửa món' : 'Thêm món';
  $('#drink-error').hidden = true; $('#img-warn').hidden = true;
  const del = $('#delete-drink'); del.hidden = !d; del.classList.remove('is-armed'); del.textContent = 'Xóa món';
  const v = d || { name: '', category: drinks[drinks.length - 1]?.category || (CATS[0] || {}).name || 'Cà phê Việt', price: '', description: '', note: '', ingredients: [], image_alt: '', is_active: true, is_featured: false };
  // Keep every managed category available, including temporarily hidden groups.
  const cat = canonicalCat(v.category) || (CATS[0] || {}).name || '';
  const names = CATS.map((c) => c.name);
  if (!names.length) { toast('Thêm ít nhất một danh mục trước khi thêm món.', true); selectTab($('#tab-categories')); return; }
  if (cat && !names.includes(cat)) names.push(cat);
  form.category.innerHTML = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  form.name.value = v.name; form.category.value = cat; form.price.value = v.price ? String(v.price) : '';
  form.description.value = v.description; form.note.value = v.note; form.ingredients.value = (v.ingredients || []).join(', ');
  const englishReady = api.demo || api.bilingual;
  $('#english-fields').disabled = !englishReady;
  $('#english-status').textContent = englishReady ? 'Dùng cho phiên bản EN. Nhập tên tiếng Anh khi thêm món mới.' : 'Cần chạy supabase/bilingual-menu.sql trong SQL Editor, sau đó tải lại trang để lưu tiếng Anh.';
  const translated = (window.HOMELODY_PRODUCT_EN || {})[v.name] || [];
  form.name_en.value = v.name_en || translated[0] || '';
  form.description_en.value = v.description_en || translated[1] || '';
  form.note_en.value = v.note_en || translated[2] || '';
  form.ingredients_en.value = (v.ingredients_en || (v.ingredients || []).map(value => (window.HOMELODY_EN || {})[value] || value)).join(', ');
  form.image_alt_en.value = v.image_alt_en || translated[0] || '';
  form.name_en.required = !!englishReady;
  validateFlavorNotes();
  form.image_alt.value = v.image_alt; form.is_active.checked = v.is_active; form.is_featured.checked = v.is_featured;
  showPreview(d && d.image_url ? viewSrc(d.image_url) : '');
  updatePricePreview();
  editorSnapshot = currentEditorSnapshot();
  editor.showModal();
  if (!d) form.name.focus();
}
function showPreview(src) {
  $('#img-preview').innerHTML = src ? `<img src="${esc(src)}" alt="">` : '<span>Chưa có ảnh</span>';
  $('#img-remove').hidden = !src;
}
function updatePricePreview() {
  const n = parsePrice(form.price.value);
  $('#price-preview').textContent = Number.isFinite(n) && form.price.value ? '→ ' + money(n) : '';
}
form.price.addEventListener('input', updatePricePreview);

$('#img-input').addEventListener('change', async (e) => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  if (file.size > 15 * 1024 * 1024) { toast('Ảnh lớn quá (trên 15MB).', true); return; }
  const warn = $('#img-warn'); warn.hidden = true;
  try {
    const p = await prepareImage(file);
    pendingImage = p; removeImageFlag = false;
    showPreview(URL.createObjectURL(p.blob));
    if (!p.transparent) {
      warn.textContent = 'Ảnh này chưa tách nền nên trên bàn xoay sẽ thành một khung chữ nhật. Nên tách nền trước (remove.bg hoặc Canva, miễn phí) rồi tải lại.';
      warn.hidden = false;
    }
    if (!form.image_alt.value && form.name.value) form.image_alt.value = 'Ly ' + form.name.value;
  } catch (ex) { toast(errText(ex), true); }
});
$('#img-remove').addEventListener('click', () => { pendingImage = null; removeImageFlag = true; showPreview(''); });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateFlavorNotes()) { form.reportValidity(); return; }
  const err = $('#drink-error'); err.hidden = true;
  const name = form.name.value.trim(), price = parsePrice(form.price.value);
  if (!name) { err.textContent = 'Nhập tên món.'; err.hidden = false; form.name.focus(); return; }
  if (!Number.isFinite(price) || price < 0) { err.textContent = 'Giá chưa đúng. Ví dụ: 45000 hoặc 45k.'; err.hidden = false; form.price.focus(); return; }

  await busy($('#save-drink'), async () => {
    try {
      const row = {
        ...(editing || {}),
        name, price,
        category: form.category.value.trim() || 'Khác',
        description: form.description.value.trim(),
        note: flavorNotes().join(' · '),
        ...((api.demo || api.bilingual) ? {
          name_en: form.name_en.value.trim(), description_en: form.description_en.value.trim(),
          note_en: flavorNotes(form.note_en).join(' · '),
          ingredients_en: form.ingredients_en.value.split(/[,;\n]/).map(value => value.trim()).filter(Boolean),
          image_alt_en: form.image_alt_en.value.trim()
        } : {}),
        ingredients: form.ingredients.value.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean),
        image_alt: form.image_alt.value.trim() || 'Ly ' + name,
        is_active: form.is_active.checked,
        is_featured: form.is_featured.checked
      };
      if (!editing) row.sort_order = (drinks.reduce((m, d) => Math.max(m, d.sort_order || 0), 0)) + 10;
      const oldImage = editing ? editing.image_url : '';
      if (pendingImage) row.image_url = await api.uploadImage(pendingImage.blob, name);
      else if (removeImageFlag) row.image_url = '';
      const saved = await api.saveDrink(row);
      if (oldImage && oldImage !== saved.image_url) await api.removeImage(oldImage);
      if (editing) Object.assign(editing, saved); else drinks.push(saved);
      editor.close(); syncCategoryFilter(); renderList();
      toast(`Đã lưu “${saved.name}”`);
    } catch (ex) { err.textContent = errText(ex); err.hidden = false; }
  });
});

$('#delete-drink').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (!btn.classList.contains('is-armed')) { btn.classList.add('is-armed'); btn.textContent = 'Bấm lần nữa để xóa'; return; }
  try {
    await api.deleteDrink(editing);
    drinks = drinks.filter((d) => d !== editing);
    editor.close(); renderList(); toast('Đã xóa món');
  } catch (ex) { toast(errText(ex), true); }
});

/* ---------- shop */
const SHOP_SETTINGS = window.HOMELODY_SHOP_SETTINGS;
$('#shop-social-links').innerHTML = SHOP_SETTINGS.fields.map(field => `
  <div class="field">
    <label class="field__label" for="shop-${field.name}">${field.label}</label>
    <input id="shop-${field.name}" name="${field.name}" type="url" inputmode="url" maxlength="2048" placeholder="${field.placeholder}" aria-describedby="current-${field.name}">
    <span class="shop-link-current" id="current-${field.name}"><span>Đang dùng:</span><a data-current-link="${field.key}" target="_blank" rel="noopener noreferrer"></a></span>
  </div>`).join('');
function displayCurrentShopLinks(links) {
  $$('[data-current-link]', $('#shop-form')).forEach(anchor => {
    const key = anchor.dataset.currentLink, url = links[key];
    if (url) { anchor.href = url; anchor.title = url; anchor.removeAttribute('aria-disabled'); }
    else { anchor.removeAttribute('href'); anchor.setAttribute('aria-disabled', 'true'); }
    if (key !== 'MAPS_URL') anchor.textContent = url || 'Chưa có liên kết';
  });
}
async function loadShop() {
  const button = $('#save-shop'), error = $('#shop-error');
  button.disabled = true; error.hidden = true;
  try {
    const s = await api.getShop();
    const f = $('#shop-form');
    const links = SHOP_SETTINGS.resolveLinks(s);
    ['address', 'hours'].forEach(k => { f.elements.namedItem(k).value = s[k] || ''; });
    f.phone.value = SHOP_SETTINGS.formatPhone(links.PHONE);
    f.directions_url.value = links.MAPS_URL;
    SHOP_SETTINGS.fields.forEach(field => { f.elements.namedItem(field.name).value = links[field.key]; });
    displayCurrentShopLinks(links);
    const ready = api.demo || Object.prototype.hasOwnProperty.call(s, 'public_links');
    f.dataset.ready = String(ready); button.disabled = !ready;
    $('#shop-save-status').textContent = ready ? 'Đang hiển thị các liên kết website sử dụng.' : 'Đang chờ cập nhật bộ lưu liên kết. Bạn vẫn có thể xem các link hiện tại.';
    return ready;
  } catch (e) {
    error.textContent = 'Không tải được thông tin quán: ' + errText(e); error.hidden = false;
    $('#shop-form').dataset.ready = 'false';
    $('#shop-save-status').textContent = 'Chưa tải được thông tin. Vui lòng tải lại trang.';
    return false;
  }
}
$('#shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, error = $('#shop-error'); error.hidden = true;
  if (f.dataset.ready !== 'true') return;
  const phone = SHOP_SETTINGS.phoneUrl(f.phone.value);
  if (!phone) { error.textContent = 'Nhập số điện thoại hợp lệ, từ 8 đến 15 chữ số.'; error.hidden = false; f.phone.focus(); return; }
  const defaults = SHOP_SETTINGS.resolveLinks({});
  const savedLinks = { PHONE: phone };
  for (const field of [...SHOP_SETTINGS.fields, { name: 'directions_url', key: 'MAPS_URL', label: 'Google Maps' }]) {
    const input = f.elements.namedItem(field.name), value = input.value.trim();
    const url = value ? SHOP_SETTINGS.webUrl(value) : defaults[field.key];
    if (value && !url) {
      error.textContent = `Link ${field.label} chưa hợp lệ. Dùng địa chỉ HTTPS, không nhập mã hoặc thông tin đăng nhập.`;
      error.hidden = false; input.focus(); return;
    }
    savedLinks[field.key] = url;
  }
  const values = {
    address: f.address.value.trim(), hours: f.hours.value.trim(), phone: SHOP_SETTINGS.formatPhone(phone),
    directions_url: savedLinks.MAPS_URL, contact_url: savedLinks.ZALO_URL,
    facebook_url: savedLinks.FACEBOOK_URL, instagram_url: savedLinks.INSTAGRAM_URL, tiktok_url: savedLinks.TIKTOK_URL,
    public_links: savedLinks
  };
  await busy($('#save-shop'), async () => {
    try {
      const saved = await api.saveShop(values);
      const links = SHOP_SETTINGS.resolveLinks(saved);
      SHOP_SETTINGS.fields.forEach(field => { f.elements.namedItem(field.name).value = links[field.key]; });
      f.directions_url.value = links.MAPS_URL; f.phone.value = SHOP_SETTINGS.formatPhone(links.PHONE);
      displayCurrentShopLinks(links);
      try { localStorage.removeItem('homelody:menu:v1'); } catch (_) { /* storage may be unavailable */ }
      $('#shop-save-status').textContent = 'Đã lưu. Các liên kết mới hiển thị khi tải lại website.';
      toast('Đã lưu thông tin và liên kết website');
    } catch (ex) { error.textContent = 'Chưa lưu được: ' + errText(ex); error.hidden = false; }
  });
});

/* Cùng cơ chế upload cho từng nhóm ảnh, mỗi nhóm lưu riêng. */
function createImageManager({ prefix, defaults: STORY_DEFAULTS, column, folder, title, labels, hints, ratios }) {
const list = $('#' + prefix + '-image-list'), error = $('#' + prefix + '-error');
const save = $('#save-' + prefix), cancel = $('#' + prefix + '-cancel'), form = $('#' + prefix + '-form');
let storySaved = [], storyDraft = [], storyPending = new Map(), storyPreviews = new Map();
let storyLoading = true, storySaving = false, storyProcessing = false, storyDirty = false;

function resetStoryDraft() {
  storyPreviews.forEach((url) => URL.revokeObjectURL(url));
  storyPreviews.clear(); storyPending.clear();
  storyDraft = structuredClone(storySaved); storyDirty = false;
  renderStoryEditor();
}
async function loadStoryImages() {
  storyLoading = true;
  try {
    const shop = await api.getShop();
    storySaved = STORY_DEFAULTS.map((fallback, i) => {
      const saved = Array.isArray(shop[column]) && shop[column][i];
      return saved && saved.image_url ? { image_url: saved.image_url, image_alt: saved.image_alt || '' } : { ...fallback };
    });
    storyLoading = false; resetStoryDraft();
  } catch (ex) {
    error.textContent = 'Không tải được ảnh: ' + errText(ex);
    error.hidden = false;
    list.setAttribute('aria-busy', 'false');
  }
}
function storyButtons() {
  const locked = storyLoading || storySaving || storyProcessing;
  save.disabled = locked || !storyDirty;
  cancel.disabled = locked || !storyDirty;
  $$('input, [data-story-reset]', list).forEach((el) => { el.disabled = locked; });
}
function renderStoryEditor() {
  list.setAttribute('aria-busy', 'false');
  list.innerHTML = storyDraft.map((row, i) => `
    <article class="story-image-card" data-story-index="${i}">
      <div class="story-image-card__preview" style="aspect-ratio:${ratios[i]}"><img src="${esc(storyPreviews.get(i) || viewSrc(row.image_url))}" alt="${esc(row.image_alt)}"></div>
      <div class="story-image-card__body">
        <h2>${esc(labels[i])}</h2><p class="field__help">${esc(hints[i])}</p>
        <label class="field"><span class="field__label">Chọn ảnh mới</span><input type="file" data-story-file accept="image/jpeg,image/png,image/webp" aria-label="Tải ảnh: ${esc(labels[i])}"></label>
        <label class="field"><span class="field__label">Mô tả ảnh</span><input data-story-alt maxlength="160" value="${esc(row.image_alt)}"></label>
        <button class="btn btn--ghost btn--sm" type="button" data-story-reset>Dùng ảnh ban đầu</button>
        <p class="field__help" data-story-status>${storyPending.has(i) ? 'Ảnh mới · Chưa lưu' : ''}</p>
      </div>
    </article>`).join('');
  storyButtons();
}

// Giữ nguyên toàn bộ ảnh; chỉ thu nhỏ và nén, không cắt theo ảnh ly đã tách nền.
async function prepareStoryImage(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('Chọn ảnh JPG, PNG hoặc WebP.');
  if (file.size > 15 * 1024 * 1024) throw new Error('Ảnh lớn quá (trên 15MB).');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const image = new Image(); image.onload = () => resolve(image);
      image.onerror = () => reject(new Error('Không đọc được ảnh này.')); image.src = url;
    });
    if (!img.naturalWidth || !img.naturalHeight || img.naturalWidth * img.naturalHeight > 24000000 || Math.max(img.naturalWidth, img.naturalHeight) > 10000) throw new Error('Ảnh quá lớn. Chọn ảnh tối đa 24 megapixel và 10.000px mỗi cạnh.');
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', .85));
    if (!blob || blob.size > 3 * 1024 * 1024) throw new Error('Không nén được ảnh dưới 3MB. Vui lòng chọn ảnh nhỏ hơn.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
list.addEventListener('change', async (event) => {
  if (!event.target.matches('[data-story-file]') || storySaving || storyProcessing) return;
  const file = event.target.files[0]; event.target.value = '';
  if (!file) return;
  const index = Number(event.target.closest('[data-story-index]').dataset.storyIndex);
  const status = $('[data-story-status]', event.target.closest('article'));
  storyProcessing = true; storyButtons(); status.textContent = 'Đang xử lý ảnh…';
  error.hidden = true;
  try {
    const blob = await prepareStoryImage(file);
    if (storyPreviews.has(index)) URL.revokeObjectURL(storyPreviews.get(index));
    storyPending.set(index, blob); storyPreviews.set(index, URL.createObjectURL(blob));
    storyDirty = true;
  } catch (ex) { error.textContent = errText(ex); error.hidden = false; }
  finally { storyProcessing = false; renderStoryEditor(); }
});
list.addEventListener('input', (event) => {
  if (!event.target.matches('[data-story-alt]')) return;
  const index = Number(event.target.closest('[data-story-index]').dataset.storyIndex);
  storyDraft[index].image_alt = event.target.value; storyDirty = true; storyButtons();
});
list.addEventListener('click', (event) => {
  if (!event.target.closest('[data-story-reset]') || storySaving || storyProcessing) return;
  const index = Number(event.target.closest('[data-story-index]').dataset.storyIndex);
  if (storyPreviews.has(index)) URL.revokeObjectURL(storyPreviews.get(index));
  storyPreviews.delete(index); storyPending.delete(index);
  storyDraft[index] = { ...STORY_DEFAULTS[index] }; storyDirty = true; renderStoryEditor();
});
cancel.addEventListener('click', () => { error.hidden = true; resetStoryDraft(); });
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!storyDirty || storySaving || storyProcessing || storyLoading) return;
  storySaving = true; storyButtons(); error.hidden = true;
  const uploaded = [], next = structuredClone(storyDraft);
  await busy(save, async () => {
    try {
      for (const [index, blob] of storyPending) {
        const url = await api.uploadImage(blob, folder + '-' + (index + 1), folder);
        uploaded.push(url); next[index].image_url = url;
      }
      await api.saveShop({ [column]: next });
    } catch (ex) {
      await Promise.allSettled(uploaded.map((url) => api.removeImage(url)));
      error.textContent = /story_images|space_images|schema cache/i.test(errText(ex))
        ? `Cần cập nhật cơ sở dữ liệu: chạy file supabase/${prefix}-images.sql trong Supabase SQL Editor, rồi lưu lại.`
        : errText(ex);
      error.hidden = false;
      return;
    }
    const old = storySaved; storySaved = next; resetStoryDraft();
    // Chỉ xóa ảnh thay thế sau khi các đường dẫn mới đã lưu thành công.
    await Promise.allSettled(old.filter((row) => !next.some((r) => r.image_url === row.image_url)).map((row) => api.removeImage(row.image_url)));
    toast(api.demo ? 'Đã lưu ảnh trên trình duyệt này' : 'Đã lưu ảnh ' + title);
  });
  storySaving = false; storyButtons();
});
window.addEventListener('beforeunload', (event) => {
  if (storyDirty || storySaving || storyProcessing) { event.preventDefault(); event.returnValue = ''; }
});

return { load: loadStoryImages };
}
const storyManager = createImageManager({
  prefix: 'story', defaults: window.HOMELODY_STORY_IMAGES || [], column: 'story_images', folder: 'story', title: 'Câu chuyện',
  labels: ['Ảnh 1', 'Ảnh 2', 'Ảnh 3 · Chính giữa', 'Ảnh 4', 'Ảnh 5'],
  hints: Array(5).fill('Ảnh dọc 3:4 · gợi ý 900 × 1200px'), ratios: Array(5).fill('3 / 4')
});
const spaceManager = createImageManager({
  prefix: 'space', defaults: window.HOMELODY_SPACE_IMAGES || [], column: 'space_images', folder: 'space', title: 'Không gian',
  labels: ['Phải trên · Một góc học bài trên tầng hai', 'Phải dưới · Thảnh thơi bên vườn', 'Bên trái · Homelody chào bạn'],
  hints: ['Ảnh ngang 2:1 · 1200 × 600px', 'Ảnh ngang 2:1 · 1200 × 600px', 'Ảnh vuông 1:1 · 1200 × 1200px'],
  ratios: ['2 / 1', '2 / 1', '1 / 1']
});

/* ---------- nhập danh sách đồ uống ---------- */
const importDialog = $('#import-editor'), importFile = $('#import-file');
const importError = $('#import-error'), importSummary = $('#import-summary');
const importPreview = $('#import-preview'), importConfirm = $('#confirm-import');
let importMatrix = null, importRows = [], importWorking = false, sheetLibrary;
function loadSheetLibrary() {
  if (!sheetLibrary) sheetLibrary = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'vendor/xlsx-0.20.3.min.js';
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => { script.remove(); sheetLibrary = null; reject(new Error('Không tải được thư viện đọc Excel. Hãy thử lại.')); };
    document.head.appendChild(script);
  });
  return sheetLibrary;
}
function renderImportPreview() {
  const count = (status) => importRows.filter((r) => r.status === status).length;
  importSummary.textContent = `${count('ready')} món có thể nhập · ${count('duplicate')} món trùng sẽ bỏ qua · ${count('error')} dòng lỗi`;
  importConfirm.disabled = !count('ready') || importWorking;
  importConfirm.textContent = `Nhập ${count('ready')} món hợp lệ`;
  importPreview.hidden = !importRows.length;
  importPreview.innerHTML = `<table><thead><tr><th>Dòng</th><th>Tên món</th><th>Nhóm</th><th>Giá</th><th>Kết quả kiểm tra</th></tr></thead><tbody>${importRows.map((r) => `<tr data-status="${r.status}"><td>${r.line}</td><td>${esc(r.name)}</td><td>${esc(r.row.category || r.category)}</td><td>${r.row.price === null ? '—' : money(r.row.price)}</td><td>${r.status === 'error' ? esc(r.errors.join(' ')) : r.status === 'duplicate' ? 'Trùng tên và nhóm · Bỏ qua' : 'Thêm mới'}</td></tr>`).join('')}</tbody></table>`;
}
function lockImport(locked) {
  importWorking = locked; importFile.disabled = locked;
  $$('[data-import-close]', importDialog).forEach((b) => { b.disabled = locked; });
  importConfirm.disabled = locked || !importRows.some((r) => r.status === 'ready');
  if (!locked && importRows.length) importConfirm.textContent = `Nhập ${importRows.filter((r) => r.status === 'ready').length} món hợp lệ`;
}
$('#open-import').addEventListener('click', () => {
  importMatrix = null; importRows = []; importFile.value = ''; importError.hidden = true;
  importSummary.textContent = ''; importPreview.hidden = true; importPreview.innerHTML = ''; lockImport(false);
  importConfirm.textContent = 'Nhập món hợp lệ'; importDialog.showModal();
});
$$('[data-import-close]', importDialog).forEach((b) => b.addEventListener('click', () => { if (!importWorking) importDialog.close(); }));
importDialog.addEventListener('cancel', (event) => { if (importWorking) event.preventDefault(); });
importFile.addEventListener('change', async () => {
  const file = importFile.files[0]; importMatrix = null; importRows = [];
  importError.hidden = true; importPreview.hidden = true; importSummary.textContent = ''; importConfirm.disabled = true;
  if (!file) return;
  lockImport(true); importSummary.textContent = 'Đang đọc và kiểm tra file…';
  try {
    if (!/\.(xlsx|csv)$/i.test(file.name)) throw new Error('Chọn file Excel .xlsx hoặc CSV UTF-8.');
    if (file.size > 5 * 1024 * 1024) throw new Error('File vượt quá 5MB.');
    const XLSX = await loadSheetLibrary();
    importMatrix = readDrinkSheet(XLSX, await file.arrayBuffer());
    importRows = buildImportPreview(importMatrix, drinks, CATS);
    renderImportPreview();
  } catch (ex) { importSummary.textContent = ''; importError.textContent = 'Không đọc được danh sách: ' + errText(ex); importError.hidden = false; }
  finally { lockImport(false); }
});
$('#import-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (importWorking || !importMatrix || !importRows.some((r) => r.status === 'ready')) return;
  lockImport(true); importError.hidden = true;
  try {
    // Đọc lại trước khi nhập để bỏ qua món đã được thêm ở lần lưu/tab khác.
    drinks = await api.listDrinks();
    importRows = buildImportPreview(importMatrix, drinks, CATS);
    const rows = importRows.filter((r) => r.status === 'ready').map((r) => r.row);
    if (!rows.length) { renderImportPreview(); renderList(); return; }
    const order = drinks.reduce((max, r) => Math.max(max, r.sort_order || 0), 0);
    rows.forEach((r, i) => { r.sort_order = order + (i + 1) * 10; });
    importConfirm.textContent = 'Đang nhập…';
    const added = await api.importDrinks(rows);
    drinks.push(...added); renderList();
    importRows = buildImportPreview(importMatrix, drinks, CATS); renderImportPreview();
    importSummary.textContent = `Đã nhập ${added.length} món. Các dòng trùng hoặc có lỗi được bỏ qua. Bạn có thể sửa file và chọn lại để nhập phần còn lại.`;
    toast(`Đã nhập ${added.length} món`);
  } catch (ex) {
    importError.textContent = 'Chưa xác nhận được kết quả nhập: ' + errText(ex) + ' Bạn có thể thử lại; admin sẽ kiểm tra lại món trùng trước khi nhập.';
    importError.hidden = false;
  } finally { lockImport(false); }
});
window.addEventListener('beforeunload', (event) => {
  if (importWorking) { event.preventDefault(); event.returnValue = ''; }
});

$('#backup-data').addEventListener('click', async (event) => {
  await busy(event.currentTarget, async () => {
    try {
      const [rows, shop] = await Promise.all([api.listDrinks(), api.getShop()]);
      const blob = new Blob([JSON.stringify({ version: 1, exported_at: new Date().toISOString(), drinks: rows, shop }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'homelody-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000);
      toast('Đã tải bản sao lưu dữ liệu');
    } catch (ex) { toast('Không sao lưu được: ' + errText(ex), true); }
  });
});

/* ---------- xóa toàn bộ sản phẩm ---------- */
const deleteAllDialog = $('#delete-all-dialog'), deleteAllForm = $('#delete-all-form');
const deleteAllInput = $('#delete-all-confirmation'), deleteAllConfirm = $('#confirm-delete-all');
const deleteAllError = $('#delete-all-error');
let deleteAllWorking = false, deleteAllCount = 0;
function updateDeleteAllButton() {
  deleteAllConfirm.disabled = deleteAllWorking || !deleteAllCount || deleteAllInput.value.trim().toUpperCase() !== 'XOA';
}
$('#delete-all-drinks').addEventListener('click', async (event) => {
  if (deleteAllWorking) return;
  await busy(event.currentTarget, async () => {
    try {
      deleteAllCount = await api.countDrinks();
      if (!deleteAllCount) { await loadDrinks(); toast('Không có sản phẩm nào để xóa.'); return; }
      deleteAllForm.reset(); deleteAllError.hidden = true;
      $('#delete-all-message').textContent = `Bạn sắp xóa toàn bộ ${deleteAllCount} sản phẩm, bao gồm cả món đang ẩn và món không khớp ô tìm kiếm. Thao tác này không thể hoàn tác trong admin.`;
      updateDeleteAllButton(); deleteAllDialog.showModal();
      $('[data-delete-all-close]', deleteAllDialog).focus();
    } catch (ex) { toast('Không kiểm tra được danh sách sản phẩm: ' + errText(ex), true); }
  });
  $('#delete-all-drinks').disabled = !drinks.length;
});
deleteAllInput.addEventListener('input', updateDeleteAllButton);
$$('[data-delete-all-close]', deleteAllDialog).forEach((btn) => btn.addEventListener('click', () => { if (!deleteAllWorking) deleteAllDialog.close(); }));
deleteAllDialog.addEventListener('cancel', (event) => { if (deleteAllWorking) event.preventDefault(); });
deleteAllForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (deleteAllWorking || !deleteAllCount || deleteAllInput.value.trim().toUpperCase() !== 'XOA') return;
  deleteAllWorking = true; deleteAllError.hidden = true; deleteAllInput.disabled = true;
  $$('[data-delete-all-close]', deleteAllDialog).forEach((btn) => { btn.disabled = true; });
  await busy(deleteAllConfirm, async () => {
    try {
      const deleted = await api.deleteAllDrinks();
      drinks = []; $('#search').value = ''; renderList();
      try { localStorage.removeItem('homelody:menu:v1'); } catch { /* cache may be disabled */ }
      deleteAllDialog.close();
      toast(`Đã xóa ${deleted ?? deleteAllCount} sản phẩm`);
    } catch (ex) {
      deleteAllError.textContent = 'Không xác nhận được kết quả xóa: ' + errText(ex) + ' Hãy tải lại danh sách trước khi thử lại.';
      deleteAllError.hidden = false;
    }
  });
  deleteAllWorking = false; deleteAllInput.disabled = false;
  $$('[data-delete-all-close]', deleteAllDialog).forEach((btn) => { btn.disabled = false; });
  updateDeleteAllButton();
});
window.addEventListener('beforeunload', (event) => {
  if (deleteAllWorking) { event.preventDefault(); event.returnValue = ''; }
});

boot();
