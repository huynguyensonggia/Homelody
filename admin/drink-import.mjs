export const HEADERS = ['Tên món', 'Nhóm', 'Giá (VNĐ)', 'Mô tả', 'Ghi chú hương vị', 'Thành phần', 'Link ảnh', 'Mô tả ảnh', 'Đang bán', 'Nổi bật'];
const fields = ['name', 'category', 'price', 'description', 'note', 'ingredients', 'image_url', 'image_alt', 'is_active', 'is_featured'];
const text = (value) => String(value ?? '').trim();
const key = (value) => text(value).normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g, ' ');
export const drinkKey = (row) => key(row.category) + '\u0000' + key(row.name);

function price(value) {
  const s = text(value).toLowerCase().replace(/\s/g, '');
  let n = NaN;
  if (/^\d+$/.test(s)) n = Number(s);
  else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) n = Number(s.replace(/[.,]/g, ''));
  else if (/^\d+([.,]\d{1,3})?k$/.test(s)) n = Number(s.slice(0, -1).replace(',', '.')) * 1000;
  if (!Number.isInteger(n) || n < 0 || n > 2147483647) throw Error('Giá phải là số nguyên VNĐ từ 0 đến 2.147.483.647 (ví dụ 45000 hoặc 45k).');
  return n;
}
function bool(value, fallback) {
  const s = key(value);
  if (!s) return fallback;
  if (['có', 'co', 'true', '1'].includes(s)) return true;
  if (['không', 'khong', 'false', '0'].includes(s)) return false;
  throw Error('Đang bán và Nổi bật chỉ nhận Có / Không, TRUE / FALSE hoặc 1 / 0.');
}

export function buildImportPreview(matrix, existing, categories) {
  if (!matrix.length) throw Error('Sheet đang trống. Giữ dòng tiêu đề như file mẫu.');
  const header = matrix[0].map((v) => key(v).replace(/\s*\*$/, ''));
  const indices = HEADERS.map((label) => header.indexOf(key(label)));
  const missing = HEADERS.slice(0, 3).filter((_, i) => indices[i] < 0);
  if (missing.length) throw Error('Thiếu cột: ' + missing.join(', ') + '. Hãy dùng file mẫu.');
  if (header.filter(Boolean).some((h, i) => header.indexOf(h) !== i)) throw Error('Tiêu đề cột bị trùng. Mỗi cột chỉ xuất hiện một lần.');
  const canon = (v) => {
    const cat = categories.find((c) => [c.name, ...(c.aliases || [])].some((name) => key(name) === key(v)));
    if (!cat) throw Error('Nhóm món không hợp lệ: ' + text(v));
    return cat.name;
  };
  const seen = new Set(existing.map((r) => drinkKey({ ...r, category: (() => { try { return canon(r.category); } catch { return r.category; } })() })));
  const source = matrix.slice(1).map((row, i) => ({ row, line: i + 2 })).filter(({ row }) => row.some((v) => text(v)));
  if (source.length > 500) throw Error('Tối đa 500 món mỗi lần nhập.');
  if (!source.length) throw Error('Chưa có món nào. Điền dữ liệu ở tab Do uong từ dòng 2.');
  return source.map(({ row, line }) => {
    const values = Object.fromEntries(fields.map((field, i) => [field, indices[i] < 0 ? '' : row[indices[i]]]));
    const errors = [];
    const result = { line, status: 'ready', errors, row: null, name: text(values.name), category: text(values.category) };
    const check = (fn) => { try { return fn(); } catch (ex) { errors.push(ex.message); return null; } };
    if (row.some((v) => v && typeof v === 'object' && v.formula)) errors.push('Không dùng công thức trong ô dữ liệu.');
    const name = text(values.name);
    if (!name || name.length > 80) errors.push('Tên món bắt buộc, tối đa 80 ký tự.');
    const category = check(() => canon(values.category));
    const amount = check(() => price(values.price));
    const active = check(() => bool(values.is_active, true));
    const featured = check(() => bool(values.is_featured, false));
    for (const [field, max, label] of [['description', 160, 'Mô tả'], ['note', 60, 'Ghi chú hương vị'], ['image_alt', 120, 'Mô tả ảnh']]) {
      if (text(values[field]).length > max) errors.push(`${label} tối đa ${max} ký tự.`);
    }
    const image = text(values.image_url);
    if (image && (!/^(https?:\/\/[^\s]+|\/?(?:assets|public)\/[^\s]+)$/i.test(image) || image.includes('..'))) errors.push('Link ảnh phải là URL http(s) hoặc đường dẫn assets/... hay public/..., không chứa khoảng trắng.');
    result.row = { name, category, price: amount, description: text(values.description), note: text(values.note), ingredients: text(values.ingredients).split(/[,;\n]/).map(text).filter(Boolean), image_url: image, image_alt: text(values.image_alt) || 'Ly ' + name, is_active: active, is_featured: featured };
    if (errors.length) result.status = 'error';
    else if (seen.has(drinkKey(result.row))) result.status = 'duplicate';
    else seen.add(drinkKey(result.row));
    return result;
  });
}

export function readDrinkSheet(XLSX, buffer) {
  const wb = XLSX.read(buffer, { type: 'array', sheetRows: 502, cellFormula: true, codepage: 65001 });
  const name = wb.SheetNames.includes('Do uong') ? 'Do uong' : wb.SheetNames[0];
  const sheet = wb.Sheets[name];
  if (!sheet) throw Error('File không có sheet dữ liệu.');
  const extent = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
  if (extent.e.r > 500) throw Error('Sheet vượt quá 500 dòng dữ liệu. Chia thành nhiều file nhỏ hơn.');
  if (extent.e.c > 30) throw Error('Sheet quá nhiều cột. Hãy dùng file mẫu.');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '', blankrows: true });
  for (const address of Object.keys(sheet)) {
    if (address.startsWith('!') || !sheet[address].f) continue;
    const { r, c } = XLSX.utils.decode_cell(address);
    if (r > 0 && rows[r]) rows[r][c] = { formula: true };
  }
  return rows;
}
