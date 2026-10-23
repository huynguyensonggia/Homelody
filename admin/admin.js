/* HOMELODY — trang quản lý thực đơn
 * Có Supabase (config.js)  → đăng nhập thật, ghi vào database + kho ảnh.
 * Chưa có                  → "chế độ xem thử": lưu vào localStorage của trình duyệt này,
 *                            trang web chính (cùng trình duyệt) sẽ đọc lại để xem trước.
 */
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
    async setOrder(rows) {
      // only the rows whose position changed
      for (const r of rows) must(await sb.from('drinks').update({ sort_order: r.sort_order }).eq('id', r.id));
    },
    async uploadImage(blob, baseName) {
      const ext = blob.type === 'image/webp' ? 'webp' : 'png';
      const path = `drinks/${Date.now()}-${slug(baseName) || 'mon'}.${ext}`;
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
    async listDrinks() { return structuredClone(state.drinks).sort((a, b) => a.sort_order - b.sort_order); },
    async saveDrink(row) {
      const copy = structuredClone(row);
      if (!copy.id) { copy.id = 'demo-' + Date.now(); state.drinks.push(copy); }
      else state.drinks = state.drinks.map((d) => (d.id === copy.id ? copy : d));
      write(state); return copy;
    },
    async deleteDrink(row) { state.drinks = state.drinks.filter((d) => d.id !== row.id); write(state); },
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
    async saveShop(values) { state.shop = { ...state.shop, ...values }; write(state); return state.shop; }
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
  if (s) enterApp(s); else showLogin();
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
  await Promise.all([loadDrinks(), loadShop()]);
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

boot();
