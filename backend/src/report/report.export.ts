import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import type { ProfitLoss } from './report.service.js';

const rupiah = (v: { toFixed(dp: number): string }) =>
  'Rp ' +
  Number(v.toFixed(2)).toLocaleString('id-ID', { maximumFractionDigits: 2 });

export function profitLossPdf(pl: ProfitLoss): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  const row = (label: string, value: string, bold = false) => {
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(11);
    doc.text(label, 50, y, { width: 330 });
    doc.text(value, 380, y, { width: 165, align: 'right' });
    doc.moveDown(0.3);
  };

  doc.font('Helvetica-Bold').fontSize(16).text('Laporan Laba Rugi');
  doc.font('Helvetica').fontSize(11).text(pl.businessName);
  doc.text(`Periode ${pl.from} s/d ${pl.to}`).moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Pendapatan').moveDown(0.3);
  for (const l of pl.income) row(l.category, rupiah(l.amount));
  row('Total Pendapatan', rupiah(pl.totalIncome), true);
  doc.moveDown();

  doc.font('Helvetica-Bold').fontSize(12).text('Beban').moveDown(0.3);
  for (const l of pl.expense) row(l.category, rupiah(l.amount));
  row('Total Beban', rupiah(pl.totalExpense), true);
  doc.moveDown();

  row(
    pl.netProfit.isNeg() ? 'Rugi Bersih' : 'Laba Bersih',
    rupiah(pl.netProfit),
    true,
  );
  doc.end();
  return done;
}

export async function profitLossXlsx(pl: ProfitLoss): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Laba Rugi');
  ws.columns = [{ width: 36 }, { width: 20 }];
  const money = '#,##0.00';
  const add = (label: string, value?: { toNumber(): number }, bold = false) => {
    const r = ws.addRow([label, value?.toNumber()]);
    r.getCell(2).numFmt = money;
    if (bold) r.font = { bold: true };
  };

  add('Laporan Laba Rugi', undefined, true);
  add(pl.businessName);
  add(`Periode ${pl.from} s/d ${pl.to}`);
  ws.addRow([]);
  add('Pendapatan', undefined, true);
  for (const l of pl.income) add(l.category, l.amount);
  add('Total Pendapatan', pl.totalIncome, true);
  ws.addRow([]);
  add('Beban', undefined, true);
  for (const l of pl.expense) add(l.category, l.amount);
  add('Total Beban', pl.totalExpense, true);
  ws.addRow([]);
  add(pl.netProfit.isNeg() ? 'Rugi Bersih' : 'Laba Bersih', pl.netProfit, true);

  return Buffer.from(await wb.xlsx.writeBuffer());
}
