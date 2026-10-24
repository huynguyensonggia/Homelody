import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const root = new URL('../../', import.meta.url);
const headers = ['Tên món', 'Nhóm', 'Giá (VNĐ)', 'Mô tả', 'Ghi chú hương vị', 'Thành phần', 'Link ảnh', 'Mô tả ảnh', 'Đang bán', 'Nổi bật'];
const cats = ['Cà phê Việt', 'Cà phê Ý', 'Bánh', 'Brunch', 'Trà', 'Nước ép', 'Đá xay', 'Sinh tố', 'Dừa'];
const wb = Workbook.create();
const data = wb.worksheets.add('Do uong');
const guide = wb.worksheets.add('Huong dan');
for (const sheet of [data, guide]) {
  sheet.showGridLines = false;
  sheet.getRange('A1:J30').format.font = { name: 'Arial', size: 11, color: '#393C36' };
  sheet.getRange('A1:J30').format.verticalAlignment = 'center';
}
data.getRange('A1:J1').values = [headers];
data.getRange('A1:J1').format.fill = '#393C36';
data.getRange('A1:J1').format.font = { name: 'Arial', size: 11, bold: true, color: '#FFFFFF' };
data.getRange('A1:J1').format.horizontalAlignment = 'center';
data.getRange('A1:J1').format.rowHeight = 32;
data.getRange('A2:J101').format.fill = '#FFF8E8';
data.getRange('A2:J101').format.rowHeight = 26;
for (const [col, width] of Object.entries({ A: 25, B: 19, C: 15, D: 38, E: 26, F: 32, G: 35, H: 30, I: 13, J: 13 })) data.getRange(`${col}:${col}`).format.columnWidth = width;
data.getRange('C2:C501').setNumberFormat('#,##0');
data.getRange('B2:B501').dataValidation = { rule: { type: 'list', values: cats } };
for (const col of ['I', 'J']) data.getRange(`${col}2:${col}501`).dataValidation = { rule: { type: 'list', values: ['Có', 'Không'] } };
data.freezePanes.freezeRows(1);
guide.getRange('A:A').format.columnWidth = 29;
guide.getRange('B:B').format.columnWidth = 105;
guide.getRange('A1').values = [['HOMELODY · NHẬP ĐỒ UỐNG']];
guide.getRange('A1:B1').format.fill = '#393C36';
guide.getRange('A1:B1').format.font = { name: 'Arial', size: 15, bold: true, color: '#FFFFFF' };
guide.getRange('A1:B1').format.rowHeight = 36;
const notes = [
  ['Cách dùng', 'Điền dữ liệu ở tab Do uong từ dòng 2. Giữ nguyên dòng tiêu đề.'],
  ['Nhập vào admin', 'Thực đơn → Nhập từ sheet → chọn file → xem trước → Nhập món hợp lệ.'],
  ['Cột bắt buộc', 'Tên món, Nhóm, Giá (VNĐ). Các cột khác có thể để trống.'],
  ['Giá (VNĐ)', 'Nhập số nguyên, ví dụ 45000. Khi nhập CSV có thể dùng 45k hoặc 45.000. Giá 0 được chấp nhận.'],
  ['Nhóm món', cats.join(', ') + '.'],
  ['Đang bán / Nổi bật', 'Chọn Có hoặc Không. Để trống: Đang bán = Có, Nổi bật = Không.'],
  ['Thành phần', 'Cách nhau bằng dấu phẩy, ví dụ: Cà phê, Sữa đặc, Đá viên.'],
  ['Link ảnh', 'Không bắt buộc. Dùng link https:// hoặc đường dẫn assets/... hay public/... trên website.'],
  ['Ảnh từ máy', 'Ảnh chèn trong ô Excel không được nhập. Sau khi nhập, bấm Sửa món để tải ảnh từ máy.'],
  ['Món trùng', 'Cùng tên và cùng nhóm sẽ được bỏ qua. Chức năng này chỉ thêm món mới, không sửa hoặc xóa món cũ.'],
  ['Dòng không hợp lệ', 'Admin ghi rõ lỗi từng dòng. Sửa file rồi chọn lại để nhập các dòng đó.'],
  ['Giới hạn', 'Tối đa 500 món mỗi lần, file XLSX hoặc CSV UTF-8 tối đa 5MB. Không dùng công thức trong các ô dữ liệu.'],
  ['Google Sheets', 'Có thể mở file này bằng Google Sheets, điền dữ liệu rồi tải xuống dạng Microsoft Excel (.xlsx).'],
  ['Ví dụ một món', 'Tên món: Cà phê mẫu; Nhóm: Cà phê Việt; Giá (VNĐ): 45000; Đang bán: Có; Nổi bật: Không.'],
  ['Lưu dữ liệu', 'Khi admin hiển thị Chế độ xem thử, dữ liệu chỉ lưu trên trình duyệt đang dùng.']
];
guide.getRange('A3:B17').values = notes;
guide.getRange('A3:A17').format.font.bold = true;
guide.getRange('A3:B17').format.wrapText = true;
guide.getRange('A3:B17').format.rowHeight = 44;
guide.getRange('A3:A17').format.fill = '#E4DDCF';
guide.getRange('B3:B17').format.fill = '#F8F5EF';
wb.recalculate();
console.log((await wb.inspect({ kind: 'table', range: 'Do uong!A1:J3', include: 'values', tableMaxRows: 3, tableMaxCols: 10 })).ndjson);
for (const [sheetName, range, file] of [['Do uong', 'A1:J6', 'template-preview.png'], ['Huong dan', 'A1:B17', 'guide-preview.png']]) {
  const png = await wb.render({ sheetName, range, scale: 1.4, format: 'png' });
  await fs.writeFile(new URL(file, import.meta.url), new Uint8Array(await png.arrayBuffer()));
}
const result = await SpreadsheetFile.exportXlsx(wb);
await result.save(new URL('homelody-import-do-uong.xlsx', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
await fs.copyFile(new URL('homelody-import-do-uong.xlsx', import.meta.url), new URL('public/templates/homelody-import-do-uong.xlsx', root));
console.log('Template exported and copied to public/templates');
