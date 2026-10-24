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
const MAX_FEATURED = Number(CFG.maxFeatured) || 6;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') + 'đ';
const configured = /^https:\/\/\S+$/.test((CFG.supabaseUrl || '').trim()) && (CFG.supabaseKey || '').trim().length > 20;

/* Images saved by the site use paths relative to the site root; the admin lives one folder down. */
function viewSrc(url) {
  if (!url) return '';
  return /^(https?:|data:|blob:|\/)/i.test(url) ? url : '../' + url;
}

/* ======================================================================== API: Supabase */
async function supabaseApi() {
  const { createClient } = await import(SUPABASE_JS);
  const sb = createClient(CFG.supabaseUrl.trim(), CFG.supabaseKey.trim());
  const must = ({ data, error }) => { if (error) throw error; return data; };
  return {
    demo: false,
    async session() {
      const { data } = await sb.auth.getSession();
      return data.session ? { email: data.session.user.email } : null;
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
      return must(await sb.from('drinks').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }));
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
    async getShop() { return structuredClone(state.shop); },
    async saveShop(values) {
      const next = { ...state, shop: { ...state.shop, ...values } };
      write(next); state = next; return structuredClone(state.shop);
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
async function busy(btn, fn) {
  const label = btn.textContent; btn.disabled = true; btn.textContent = 'Đang lưu…';
  try { return await fn(); } finally { btn.disabled = false; btn.textContent = label; }
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
  await Promise.all([loadDrinks(), loadShop(), storyManager.load(), spaceManager.load()]);
}

$('#logout').addEventListener('click', async () => { await api.signOut(); location.reload(); });

/* tabs */
$$('.tab').forEach((tab) => tab.addEventListener('click', () => selectTab(tab)));
$('.tabs').addEventListener('keydown', (e) => {
  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
  const tabs = $$('.tab'), i = tabs.indexOf(document.activeElement);
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length];
  selectTab(next); next.focus();
});
function selectTab(tab) {
  $$('.tab').forEach((t) => {
    const on = t === tab;
    t.classList.toggle('is-active', on); t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1;
    $('#' + t.getAttribute('aria-controls')).hidden = !on;
  });
}

/* ---------- nhóm món: lấy từ config.js → menuCategories; tên cũ (aliases) được quy về nhóm mới */
const CATS = ((window.HOMELODY_CONFIG || {}).menuCategories || [])
  .filter((c) => c && c.name)
  .map((c) => ({ name: String(c.name).trim(), aliases: (c.aliases || []).map((x) => String(x).trim()) }));
const catKey = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
function canonicalCat(v) {
  const k = catKey(v);
  const hit = CATS.find((c) => catKey(c.name) === k || c.aliases.some((x) => catKey(x) === k));
  return hit ? hit.name : String(v || '').trim();
}

/* ---------- drinks list */
async function loadDrinks() {
  try { drinks = await api.listDrinks(); renderList(); }
  catch (e) { $('#drink-list').innerHTML = `<p class="empty">Không tải được danh sách món: ${esc(errText(e))}</p>`; }
}
function renderList() {
  $('#delete-all-drinks').disabled = !drinks.length;
  const q = $('#search').value.trim().toLowerCase();
  const list = $('#drink-list');
  const shown = drinks.filter((d) => !q || (d.name + ' ' + canonicalCat(d.category)).toLowerCase().includes(q));
  const featured = drinks.filter((d) => d.is_featured && d.is_active).length;
  $('#featured-hint').textContent = `${drinks.length} món · ${featured} món nổi bật` +
    (featured > MAX_FEATURED ? ` (chỉ ${MAX_FEATURED} món đầu được hiện trên bàn xoay)` : featured === 0 ? ' (chưa chọn món nổi bật nào: bàn xoay sẽ dùng 4 món đầu)' : '');

  if (!shown.length) {
    list.innerHTML = `<p class="empty">${q ? 'Không có món nào khớp.' : 'Chưa có món nào. Bấm “+ Thêm món” để bắt đầu.'}</p>`;
    return;
  }
  // nhóm theo tên chuẩn, đúng thứ tự tab trên web; nhóm lạ (chưa khai báo) xếp cuối
  const groups = new Map(CATS.map((c) => [c.name, []]));
  shown.forEach((d) => { const k = canonicalCat(d.category) || 'Khác'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(d); });
  [...groups.keys()].forEach((k) => { if (!groups.get(k).length) groups.delete(k); });
  list.innerHTML = [...groups].map(([name, items]) => `
    <section class="group">
      <h3 class="group__title">${esc(name)} · ${items.length}</h3>
      <div class="group__items">${items.map((d) => {
        const up = neighbour(d, -1) < 0, down = neighbour(d, 1) < 0;
        return `
        <article class="drink${d.is_active ? '' : ' is-off'}" data-id="${esc(d.id)}">
          <div class="drink__thumb">${d.image_url ? `<img src="${esc(viewSrc(d.image_url))}" alt="" loading="lazy">` : '<span>Chưa ảnh</span>'}</div>
          <div class="drink__main" data-edit>
            <p class="drink__name">${esc(d.name)}</p>
            <p class="drink__meta"><span>${money(d.price)}</span>
              ${d.is_featured ? '<span class="badge badge--star">★ Nổi bật</span>' : ''}
              ${d.is_active ? '' : '<span class="badge badge--off">Đang ẩn</span>'}</p>
          </div>
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

$('#drink-list').addEventListener('click', async (e) => {
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
$('#add-drink').addEventListener('click', () => openEditor(null));
$$('[data-close]', editor).forEach((b) => b.addEventListener('click', () => editor.close()));
editor.addEventListener('click', (e) => { if (e.target === editor) editor.close(); });

function openEditor(d) {
  editing = d; pendingImage = null; removeImageFlag = false;
  form.reset();
  $('#editor-title').textContent = d ? 'Sửa món' : 'Thêm món';
  $('#drink-error').hidden = true; $('#img-warn').hidden = true;
  const del = $('#delete-drink'); del.hidden = !d; del.classList.remove('is-armed'); del.textContent = 'Xóa món';
  const v = d || { name: '', category: drinks[drinks.length - 1]?.category || (CATS[0] || {}).name || 'Cà phê Việt', price: '', description: '', note: '', ingredients: [], image_alt: '', is_active: true, is_featured: false };
  // ô Nhóm: luôn liệt kê đủ các nhóm trong config.js; nhóm lạ của món đang sửa (nếu có) được giữ thêm ở cuối
  const cat = canonicalCat(v.category) || (CATS[0] || {}).name || '';
  const names = CATS.map((c) => c.name);
  if (cat && !names.includes(cat)) names.push(cat);
  form.category.innerHTML = names.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('');
  form.name.value = v.name; form.category.value = cat; form.price.value = v.price ? String(v.price) : '';
  form.description.value = v.description; form.note.value = v.note; form.ingredients.value = (v.ingredients || []).join(', ');
  form.image_alt.value = v.image_alt; form.is_active.checked = v.is_active; form.is_featured.checked = v.is_featured;
  showPreview(d && d.image_url ? viewSrc(d.image_url) : '');
  updatePricePreview();
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
        note: form.note.value.trim(),
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
      editor.close(); renderList();
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
async function loadShop() {
  try {
    const s = await api.getShop();
    const f = $('#shop-form');
    ['address', 'hours', 'phone', 'directions_url', 'contact_url', 'facebook_url', 'instagram_url', 'tiktok_url']
      .forEach((k) => { f[k].value = s[k] || ''; });
  } catch (e) { toast('Không tải được thông tin quán: ' + errText(e), true); }
}
$('#shop-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.currentTarget, values = {};
  for (const k of ['address', 'hours', 'phone', 'directions_url', 'contact_url', 'facebook_url', 'instagram_url', 'tiktok_url']) values[k] = f[k].value.trim();
  for (const k of ['directions_url', 'contact_url', 'facebook_url', 'instagram_url', 'tiktok_url']) {
    if (values[k] && !/^https?:\/\//i.test(values[k])) values[k] = 'https://' + values[k].replace(/^\/+/, '');
  }
  await busy($('button[type=submit]', f), async () => {
    try { await api.saveShop(values); await loadShop(); toast('Đã lưu thông tin quán'); }
    catch (ex) { toast(errText(ex), true); }
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
  labels: ['Trái trên · Một góc học bài trên tầng hai', 'Trái dưới · Một chỗ bên hiên', 'Bên phải · Homelody chào bạn'],
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
