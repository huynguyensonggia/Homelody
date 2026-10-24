import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Workbook, SpreadsheetFile, FileBlob } from '@oai/artifact-tool';
import { buildImportPreview, HEADERS } from '../../admin/drink-import.mjs';
const here = (name) => new URL(name, import.meta.url);
const source = JSON.parse(await fs.readFile(here('menu-from-images.json'), 'utf8'));
const cats = ['Cà phê Việt', 'Cà phê Ý', 'Bánh', 'Brunch', 'Trà', 'Nước ép', 'Đá xay', 'Sinh tố', 'Dừa'];
const rows = source.map(([name, group, price, description, note, featured]) => [name, group, price, description, note, '', '', '', 'Có', featured ? 'Có' : 'Không']);
const preview = buildImportPreview([HEADERS, ...rows], [], cats.map((name) => ({ name })));
if (preview.length !== 42 || preview.some((r) => r.status !== 'ready')) throw Error('Import validation failed: ' + JSON.stringify(preview.filter((r) => r.status !== 'ready')));
const wb = await SpreadsheetFile.importXlsx(await FileBlob.load(fileURLToPath(here('homelody-import-do-uong.xlsx'))));
const data = wb.worksheets.getItem('Do uong'), guide = wb.worksheets.getItem('Huong dan');
data.getRange('A2:J43').values = rows;
data.getRange('A2:J43').format.font = { name: 'Arial', size: 11, color: '#000000' };
data.getRange('A2:J43').format.rowHeight = 60;
data.getRange('A2:J43').format.wrapText = true;
data.getRange('A1:J501').format.fill = '#FFFFFF';
data.getRange('A1:J1').format.fill = '#EEEEEE';
data.getRange('A1:J1').format.font = { name: 'Arial', size: 11, bold: true, color: '#000000' };
data.getRange('A:A').format.columnWidth = 31;
data.getRange('D:D').format.columnWidth = 56;
data.getRange('E:E').format.columnWidth = 38;
data.getRange('B2:B501').dataValidation = { rule: { type: 'list', values: cats } };
guide.getRange('A1:B30').format.fill = '#FFFFFF';
guide.getRange('A1:B1').format.fill = '#EEEEEE';
guide.getRange('A1:B1').format.font = { name: 'Arial', size: 15, bold: true, color: '#000000' };
guide.getRange('A3:B30').format.font = { name: 'Arial', size: 11, color: '#000000' };
guide.getRange('A3:A30').format.font.bold = true;
guide.getRange('A7:B7').values = [['Nhóm món', cats.join(', ') + '.']];
guide.getRange('A19:B26').values = [
  ['Nguồn tên và giá', 'Ảnh menu do chủ quán cung cấp trong cuộc trò chuyện này. Giá ghi theo VNĐ: 30 trong ảnh tương ứng 30.000đ.'],
  ['Phạm vi', '42 đồ uống. Trang Nước ép / Coco & More được gửi hai lần, chỉ nhập một lần.'],
  ['Nước ép 32.000đ', 'Tách dòng Chanh / Dứa / Dưa hấu / Chanh dây thành 4 món riêng, mỗi món 32.000đ.'],
  ['Nội dung tự viết', 'Hai cột Mô tả và Ghi chú hương vị do trợ lý soạn theo tên món; chủ quán có thể sửa cho đúng công thức thực tế.'],
  ['Cột để trống', 'Thành phần, Link ảnh và Mô tả ảnh để trống vì chưa có công thức và ảnh riêng đã được xác nhận.'],
  ['Trạng thái', 'Đang bán = Có. Nổi bật = Có cho 9 món có ngôi sao trên ảnh menu. Website hiện chỉ hiển thị tối đa 6 món nổi bật.'],
  ['Phụ thu', '9 lựa chọn thêm kem, sữa, cà phê và syrup ở tab Phu thu. Admin chỉ nhập tab Do uong.'],
  ['Lưu ý nhập lại', 'Admin bỏ qua món cùng tên và nhóm đã có; file này không tự cập nhật giá của món cũ.']
];
guide.getRange('A19:B26').format.wrapText = true;
guide.getRange('A19:B26').format.rowHeight = 48;
const extra = wb.worksheets.add('Phu thu');
extra.showGridLines = false;
extra.getRange('A1:C10').format.font = { name: 'Arial', size: 11, color: '#000000' };
extra.getRange('A1:C10').format.verticalAlignment = 'center';
extra.getRange('A1:C10').format.rowHeight = 32;
extra.getRange('A:A').format.columnWidth = 33;
extra.getRange('B:B').format.columnWidth = 17;
extra.getRange('C:C').format.columnWidth = 65;
extra.getRange('A1:C1').values = [['Lựa chọn thêm', 'Giá (VNĐ)', 'Ghi chú']];
extra.getRange('A1:C1').format.fill = '#EEEEEE';
extra.getRange('A1:C1').format.font.bold = true;
extra.getRange('A1:C1').format.horizontalAlignment = 'center';
extra.getRange('A2:C10').values = [
  ['Kem trứng', 10000, 'Extra Egg Cream — mục Cà phê Việt'],
  ['Kem muối', 10000, 'Salted Foam — mục Cà phê Việt'],
  ['Kem cheese', 10000, 'Cheese Foam — mục Cà phê Việt'],
  ['Sữa', 5000, 'Extra Milk — Cà phê Việt và Cà phê Ý'],
  ['Sữa yến mạch', 10000, 'Oatmilk — Cà phê Việt và Cà phê Ý'],
  ['Cà phê phin thêm', 7000, 'Extra Phin Coffee — mục Cà phê Việt'],
  ['Espresso shot thêm', 15000, 'Extra Espresso Shot — mục Cà phê Ý'],
  ['Syrup bạc hà', 10000, 'Extra syrup: Mint — mục Đá xay'],
  ['Syrup caramel', 10000, 'Extra syrup: Caramel — mục Đá xay']
];
extra.getRange('B2:B10').setNumberFormat('#,##0');
extra.freezePanes.freezeRows(1);
wb.recalculate();
console.log(JSON.stringify({ drinks: rows.length, featured: source.filter((r) => r[5]).length, groups: Object.fromEntries(cats.map((name) => [name, source.filter((r) => r[1] === name).length])) }));
for (const [sheetName, range, name] of [['Do uong', 'A1:E15', 'menu-preview.png'], ['Do uong', 'A29:E43', 'menu-tea-preview.png'], ['Huong dan', 'A19:B26', 'menu-notes-preview.png'], ['Phu thu', 'A1:C10', 'menu-extras-preview.png']]) {
  const png = await wb.render({ sheetName, range, scale: 1.4, format: 'png' });
  await fs.writeFile(here(name), new Uint8Array(await png.arrayBuffer()));
}
const result = await SpreadsheetFile.exportXlsx(wb);
await result.save(fileURLToPath(here('homelody-menu-da-dien.xlsx')));
console.log('Filled workbook exported');
