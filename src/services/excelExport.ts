import * as XLSX from 'xlsx';
import type { AppData, Customer, LpgTransaction, Expense } from '../types';
import { formatDate } from '../utils/formatters';
import { fileSystemService } from './fileSystemService';

// Format Mata Uang Rupiah Otomatis (Positif; Negatif dalam kurung; Nol)
export const RUPIAH_NUM_FMT = '"Rp "#,##0;("Rp "#,##0);"Rp "0';
export const INTEGER_NUM_FMT = '#,##0';
export const DECIMAL_NUM_FMT = '#,##0.00';

type SheetCategoryTheme = 'lpg' | 'expedition' | 'general' | 'consolidation';

interface ThemePalette {
  titleHex: string;
  headerBgHex: string;
  headerTextHex: string;
  zebraBgHex: string;
  totalBgHex: string;
  totalTextHex: string;
  borderHex: string;
}

const THEME_PALETTES: Record<SheetCategoryTheme, ThemePalette> = {
  lpg: {
    titleHex: '0E7490',
    headerBgHex: '0E7490',
    headerTextHex: 'FFFFFF',
    zebraBgHex: 'F4FBFD',
    totalBgHex: 'E2F2F6',
    totalTextHex: '0F172A',
    borderHex: 'CBD5E1',
  },
  expedition: {
    titleHex: '5B21B6',
    headerBgHex: '5B21B6',
    headerTextHex: 'FFFFFF',
    zebraBgHex: 'F9F6FF',
    totalBgHex: 'ECE5FB',
    totalTextHex: '1E1B4B',
    borderHex: 'CBD5E1',
  },
  general: {
    titleHex: 'B45309',
    headerBgHex: '334155',
    headerTextHex: 'FFFFFF',
    zebraBgHex: 'F8FAFC',
    totalBgHex: 'FEF3C7',
    totalTextHex: '0F172A',
    borderHex: 'CBD5E1',
  },
  consolidation: {
    titleHex: '0F172A',
    headerBgHex: '0F172A',
    headerTextHex: 'FFFFFF',
    zebraBgHex: 'F8FAFC',
    totalBgHex: 'DCFCE7',
    totalTextHex: '14532D',
    borderHex: 'CBD5E1',
  },
};

export interface ColumnDef {
  header: string;
  key: string;
  width: number;
  type: 'string' | 'number' | 'currency' | 'date';
  numFmt?: string;
}

interface ExcelCellStyle {
  font?: {
    name?: string;
    sz?: number;
    bold?: boolean;
    italic?: boolean;
    color?: { rgb: string };
  };
  fill?: {
    patternType: 'solid';
    fgColor: { rgb: string };
  };
  alignment?: {
    horizontal?: 'left' | 'center' | 'right';
    vertical?: 'center' | 'top' | 'bottom';
    wrapText?: boolean;
  };
  border?: {
    top?: { style: 'thin' | 'medium' | 'double'; color: { rgb: string } };
    bottom?: { style: 'thin' | 'medium' | 'double'; color: { rgb: string } };
    left?: { style: 'thin' | 'medium' | 'double'; color: { rgb: string } };
    right?: { style: 'thin' | 'medium' | 'double'; color: { rgb: string } };
  };
  numFmt?: string;
}

type StyledCell = XLSX.CellObject & { s?: ExcelCellStyle };

function makeThinBorder(rgb: string = 'CBD5E1'): ExcelCellStyle['border'] {
  return {
    top: { style: 'thin', color: { rgb } },
    bottom: { style: 'thin', color: { rgb } },
    left: { style: 'thin', color: { rgb } },
    right: { style: 'thin', color: { rgb } },
  };
}

// Buat worksheet lengkap dengan blok judul, styling header, zebra row, auto-filter,
// dan format mata uang Rupiah otomatis (Rp) pada sel data maupun baris Grand Total.
function createNeatWorksheet(
  companyName: string,
  reportTitle: string,
  periodSubtitle: string,
  columns: ColumnDef[],
  dataRows: Array<Record<string, string | number | undefined>>,
  totals?: Record<string, number | string>,
  themeKey: SheetCategoryTheme = 'consolidation'
): XLSX.WorkSheet {
  const palette = THEME_PALETTES[themeKey];
  const aoa: Array<Array<string | number>> = [];

  // Row 1 (r=0): Nama Perusahaan
  const safeCompanyName = companyName?.trim() || 'KASPRO';
  aoa.push([safeCompanyName.toUpperCase()]);
  // Row 2 (r=1): Judul Laporan
  aoa.push([reportTitle]);
  // Row 3 (r=2): Metadata Periode & Waktu Cetak
  const printedDate = new Date().toLocaleDateString('id-ID');
  const printedTime = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  });
  aoa.push([
    `Periode: ${periodSubtitle}   |   Dicetak: ${printedDate} ${printedTime}   |   Format Mata Uang: Rupiah (IDR)`,
  ]);
  // Row 4 (r=3): Spasi Kosong
  aoa.push([]);

  // Row 5 (r=4): Header Tabel
  const headerRow = columns.map((c) => c.header);
  aoa.push(headerRow);

  // Row 6+ (r>=5): Baris Data
  const hasData = dataRows.length > 0;
  if (!hasData) {
    const emptyRow = new Array<string | number>(columns.length).fill('');
    emptyRow[Math.min(1, columns.length - 1)] =
      'Tidak ada catatan data pada periode ini';
    aoa.push(emptyRow);
  } else {
    dataRows.forEach((row) => {
      const rowVals = columns.map((c) => {
        const val = row[c.key];
        if (c.type === 'number' || c.type === 'currency') {
          return typeof val === 'number' && !Number.isNaN(val)
            ? val
            : Number(val) || 0;
        }
        return val !== undefined && val !== null && val !== '' ? String(val) : '-';
      });
      aoa.push(rowVals);
    });
  }

  // Baris Grand Total (jika ada data)
  let totalRowIndex = -1;
  if (totals && hasData) {
    aoa.push([]); // spasi pemisah sebelum total
    const totalRow = columns.map((c, idx) => {
      if (totals[c.key] !== undefined) return totals[c.key];
      if (idx === 0) return 'TOTAL';
      return '';
    });
    totalRowIndex = aoa.length;
    aoa.push(totalRow);
  }

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Lebar kolom otomatis + padding aman agar nominal Rp jutaan tidak tampil ###
  ws['!cols'] = columns.map((c) => {
    const minWidth = c.type === 'currency' ? Math.max(c.width, 20) : c.width;
    return { wch: minWidth };
  });

  // Tinggi baris (!rows) agar header & judul lega dan profesional
  const rowsMeta: Array<{ hpt: number }> = [];
  for (let r = 0; r < aoa.length; r++) {
    if (r === 0) rowsMeta.push({ hpt: 26 });
    else if (r === 1) rowsMeta.push({ hpt: 21 });
    else if (r === 2) rowsMeta.push({ hpt: 18 });
    else if (r === 3) rowsMeta.push({ hpt: 10 });
    else if (r === 4) rowsMeta.push({ hpt: 28 }); // Header tabel
    else if (r === totalRowIndex) rowsMeta.push({ hpt: 24 }); // Baris total
    else rowsMeta.push({ hpt: 20 });
  }
  ws['!rows'] = rowsMeta;

  // Merge sel untuk blok judul atas
  const lastColIdx = Math.max(columns.length - 1, 1);
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: lastColIdx } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: lastColIdx } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: lastColIdx } },
  ];

  // Freeze 5 baris teratas (Judul + Header)
  ws['!freeze'] = { xSplit: 0, ySplit: 5 };

  // Pasang AutoFilter pada baris header tabel
  const lastDataRowIdx = hasData ? 4 + dataRows.length : 5;
  ws['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 4, c: 0 },
      e: { r: lastDataRowIdx, c: lastColIdx },
    }),
  };

  // Styling Blok Judul (Baris 0, 1, 2)
  const titleCell = ws['A1'] as StyledCell | undefined;
  if (titleCell) {
    titleCell.s = {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: palette.titleHex } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  const subtitleCell = ws['A2'] as StyledCell | undefined;
  if (subtitleCell) {
    subtitleCell.s = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E293B' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }
  const metaCell = ws['A3'] as StyledCell | undefined;
  if (metaCell) {
    metaCell.s = {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '64748B' } },
      alignment: { horizontal: 'left', vertical: 'center' },
    };
  }

  // Styling Header Kolom (Baris r=4)
  for (let C = 0; C < columns.length; ++C) {
    const colDef = columns[C];
    const cellRef = XLSX.utils.encode_cell({ r: 4, c: C });
    const cell = ws[cellRef] as StyledCell | undefined;
    if (cell) {
      const horizAlign: 'left' | 'center' | 'right' =
        colDef.type === 'currency' || colDef.type === 'number'
          ? 'right'
          : colDef.type === 'date' || colDef.key === 'no'
            ? 'center'
            : 'left';
      cell.s = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: true,
          color: { rgb: palette.headerTextHex },
        },
        fill: { patternType: 'solid', fgColor: { rgb: palette.headerBgHex } },
        alignment: { horizontal: horizAlign, vertical: 'center', wrapText: true },
        border: makeThinBorder(palette.headerBgHex),
      };
    }
  }

  // Styling & Number Format (Rp) untuk Baris Data & Baris Grand Total
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 5; R <= range.e.r; ++R) {
    const isTotalRow = R === totalRowIndex;
    const isSeparatorRow = totalRowIndex > 0 && R === totalRowIndex - 1;
    if (isSeparatorRow) continue;

    const isEvenDataRow = (R - 5) % 2 === 1;

    for (let C = 0; C < columns.length; ++C) {
      const colDef = columns[C];
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      let cell = ws[cellRef] as StyledCell | undefined;

      if (!cell && isTotalRow) {
        ws[cellRef] = { t: 's', v: '' };
        cell = ws[cellRef] as StyledCell;
      }
      if (!cell) continue;

      const isNumericCell = typeof cell.v === 'number';
      const resolvedNumFmt =
        colDef.numFmt ||
        (colDef.type === 'currency'
          ? RUPIAH_NUM_FMT
          : colDef.type === 'number'
            ? INTEGER_NUM_FMT
            : undefined);

      if (isNumericCell && resolvedNumFmt) {
        cell.t = 'n';
        cell.z = resolvedNumFmt;
      }

      const horizAlign: 'left' | 'center' | 'right' = isNumericCell
        ? 'right'
        : colDef.type === 'date' || colDef.key === 'no'
          ? 'center'
          : 'left';

      if (isTotalRow) {
        cell.s = {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: true,
            color: { rgb: palette.totalTextHex },
          },
          fill: { patternType: 'solid', fgColor: { rgb: palette.totalBgHex } },
          alignment: { horizontal: horizAlign, vertical: 'center' },
          border: {
            top: { style: 'medium', color: { rgb: palette.headerBgHex } },
            bottom: { style: 'double', color: { rgb: palette.headerBgHex } },
            left: { style: 'thin', color: { rgb: palette.borderHex } },
            right: { style: 'thin', color: { rgb: palette.borderHex } },
          },
          ...(isNumericCell && resolvedNumFmt ? { numFmt: resolvedNumFmt } : {}),
        };
      } else {
        cell.s = {
          font: {
            name: 'Calibri',
            sz: 10,
            bold: colDef.type === 'currency',
            color: { rgb: '0F172A' },
          },
          fill: {
            patternType: 'solid',
            fgColor: { rgb: isEvenDataRow ? palette.zebraBgHex : 'FFFFFF' },
          },
          alignment: { horizontal: horizAlign, vertical: 'center' },
          border: makeThinBorder(palette.borderHex),
          ...(isNumericCell && resolvedNumFmt ? { numFmt: resolvedNumFmt } : {}),
        };
      }
    }
  }

  return ws;
}

// Buat Sheet Ringkasan Eksekutif dengan styling header & format Rupiah otomatis
function createSummarySheet(
  companyName: string,
  title: string,
  period: string,
  metrics: Array<{
    section?: string;
    label: string;
    value: string | number;
    isCurrency?: boolean;
    isHighlight?: boolean;
  }>,
  themeKey: SheetCategoryTheme = 'consolidation'
): XLSX.WorkSheet {
  const palette = THEME_PALETTES[themeKey];
  const safeCompanyName = companyName?.trim() || 'KASPRO';
  const aoa: Array<Array<string | number>> = [
    [safeCompanyName.toUpperCase()],
    [title],
    [
      `Periode: ${period}   |   Waktu Cetak: ${new Date().toLocaleDateString('id-ID')}   |   Status: Laporan Resmi Terverifikasi`,
    ],
    [],
    ['INDIKATOR KEUANGAN & OPERASIONAL', 'NILAI / HASIL REKAPITULASI'],
  ];

  const rowMetaKind: Array<'title' | 'header' | 'blank' | 'section' | 'metric' | 'highlight'> = [
    'title',
    'title',
    'title',
    'blank',
    'header',
  ];

  metrics.forEach((m) => {
    if (m.section) {
      aoa.push([]);
      rowMetaKind.push('blank');
      aoa.push([m.section.toUpperCase(), '']);
      rowMetaKind.push('section');
    } else {
      aoa.push([m.label, m.value]);
      rowMetaKind.push(m.isHighlight ? 'highlight' : 'metric');
    }
  });

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 48 }, { wch: 32 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
  ];
  ws['!freeze'] = { xSplit: 0, ySplit: 5 };

  ws['!rows'] = rowMetaKind.map((k, idx) => {
    if (idx === 0) return { hpt: 26 };
    if (k === 'header') return { hpt: 26 };
    if (k === 'section') return { hpt: 22 };
    if (k === 'highlight') return { hpt: 24 };
    if (k === 'blank') return { hpt: 10 };
    return { hpt: 20 };
  });

  // Styling Judul
  const cA1 = ws['A1'] as StyledCell | undefined;
  if (cA1) {
    cA1.s = {
      font: { name: 'Calibri', sz: 14, bold: true, color: { rgb: palette.titleHex } },
    };
  }
  const cA2 = ws['A2'] as StyledCell | undefined;
  if (cA2) {
    cA2.s = {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '1E293B' } },
    };
  }
  const cA3 = ws['A3'] as StyledCell | undefined;
  if (cA3) {
    cA3.s = {
      font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '64748B' } },
    };
  }

  // Styling Header Tabel Ringkasan (r=4)
  ['A5', 'B5'].forEach((ref, idx) => {
    const cell = ws[ref] as StyledCell | undefined;
    if (cell) {
      cell.s = {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: palette.headerBgHex } },
        alignment: { horizontal: idx === 0 ? 'left' : 'right', vertical: 'center' },
        border: makeThinBorder(palette.headerBgHex),
      };
    }
  });

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let R = 5; R <= range.e.r; ++R) {
    const kind = rowMetaKind[R] || 'metric';
    if (kind === 'blank') continue;

    const labelCell = ws[XLSX.utils.encode_cell({ r: R, c: 0 })] as StyledCell | undefined;
    const valCell = ws[XLSX.utils.encode_cell({ r: R, c: 1 })] as StyledCell | undefined;

    if (kind === 'section') {
      [labelCell, valCell].forEach((c) => {
        if (c) {
          c.s = {
            font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: palette.titleHex } },
            fill: { patternType: 'solid', fgColor: { rgb: palette.zebraBgHex } },
            alignment: { horizontal: 'left', vertical: 'center' },
            border: makeThinBorder(palette.borderHex),
          };
        }
      });
      continue;
    }

    const isHighlight = kind === 'highlight' || (labelCell && String(labelCell.v).includes('TOTAL')) || (labelCell && String(labelCell.v).includes('LABA BERSIH'));

    if (labelCell) {
      labelCell.s = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: Boolean(isHighlight),
          color: { rgb: isHighlight ? palette.totalTextHex : '1E293B' },
        },
        fill: {
          patternType: 'solid',
          fgColor: { rgb: isHighlight ? palette.totalBgHex : 'FFFFFF' },
        },
        alignment: { horizontal: 'left', vertical: 'center' },
        border: makeThinBorder(palette.borderHex),
      };
    }

    if (valCell) {
      const isNum = typeof valCell.v === 'number';
      if (isNum) {
        valCell.t = 'n';
        valCell.z = RUPIAH_NUM_FMT;
      }
      valCell.s = {
        font: {
          name: 'Calibri',
          sz: 10,
          bold: Boolean(isHighlight || isNum),
          color: { rgb: isHighlight ? palette.totalTextHex : '0F172A' },
        },
        fill: {
          patternType: 'solid',
          fgColor: { rgb: isHighlight ? palette.totalBgHex : 'FFFFFF' },
        },
        alignment: { horizontal: 'right', vertical: 'center' },
        border: makeThinBorder(palette.borderHex),
        ...(isNum ? { numFmt: RUPIAH_NUM_FMT } : {}),
      };
    }
  }

  return ws;
}

// Helper pembuatan worksheet Pengeluaran per Sektor Kategori (LPG / Ekspedisi / Pengeluaran Umum)
function buildSectorExpenseSheet(
  companyName: string,
  reportTitle: string,
  periodLabel: string,
  expensesList: Expense[],
  totalLabel: string,
  themeKey: SheetCategoryTheme
): XLSX.WorkSheet {
  const totalCost = expensesList.reduce((s, e) => s + e.total, 0);
  const totalQty = expensesList.reduce((s, e) => s + (e.quantity || 1), 0);

  const expCols: ColumnDef[] = [
    { header: 'No', key: 'no', width: 6, type: 'number' },
    { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
    { header: 'Kategori Biaya', key: 'category', width: 24, type: 'string' },
    { header: 'Deskripsi Pengeluaran', key: 'description', width: 34, type: 'string' },
    { header: 'Kuantitas', key: 'quantity', width: 12, type: 'number' },
    { header: 'Harga Satuan (Rp)', key: 'unitPrice', width: 20, type: 'currency' },
    { header: 'Total Biaya (Rp)', key: 'total', width: 22, type: 'currency' },
    { header: 'Catatan', key: 'notes', width: 26, type: 'string' },
  ];

  const expRows = expensesList.map((e, idx) => ({
    no: idx + 1,
    date: formatDate(e.date, 'short'),
    category: e.category,
    description: e.description,
    quantity: e.quantity || 1,
    unitPrice: e.unitPrice || e.total,
    total: e.total,
    notes: e.notes || '-',
  }));

  return createNeatWorksheet(
    companyName,
    reportTitle,
    periodLabel,
    expCols,
    expRows,
    {
      description: totalLabel,
      quantity: totalQty,
      total: totalCost,
    },
    themeKey
  );
}

export const excelExportService = {
  // ----------------------------------------------------
  // EKSPOR KHUSUS DIVISI LPG 3 KG
  // ----------------------------------------------------
  async exportLpgRecap(
    appData: AppData,
    lpgFiltered: LpgTransaction[],
    lpgExpenses: Expense[],
    periodLabel: string,
    fileNameSuffix: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const totalRevenue = lpgFiltered.reduce((s, t) => s + t.total, 0);
    const totalCost = lpgExpenses.reduce((s, e) => s + e.total, 0);
    const netProfit = totalRevenue - totalCost;
    const totalCylinders = lpgFiltered.reduce((s, t) => s + t.quantity, 0);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan LPG
    const wsSummary = createSummarySheet(
      appData.settings.companyName,
      'REKAPITULASI DIVISI GAS LPG 3 KG',
      periodLabel,
      [
        { section: 'Ringkasan Laba Rugi Divisi LPG', label: '', value: '' },
        { label: 'Total Penjualan Gas LPG 3 Kg', value: totalRevenue, isCurrency: true },
        { label: 'Total Biaya Operasional Pangkalan LPG', value: totalCost, isCurrency: true },
        { label: 'LABA BERSIH DIVISI LPG', value: netProfit, isCurrency: true, isHighlight: true },
        { section: 'Volume & Frekuensi Penjualan', label: '', value: '' },
        { label: 'Total Tabung Terjual', value: `${totalCylinders.toLocaleString('id-ID')} Tabung` },
        { label: 'Jumlah Transaksi Penjualan', value: `${lpgFiltered.length} Transaksi` },
        { label: 'Jumlah Pelanggan / Pangkalan Aktif', value: `${appData.customers.length} Pelanggan` },
      ],
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan LPG');

    // Sheet 2: Transaksi Penjualan LPG
    const lpgCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Nama Pelanggan / Pangkalan', key: 'customerName', width: 30, type: 'string' },
      { header: 'Jumlah Tabung', key: 'quantity', width: 16, type: 'number' },
      { header: 'Harga Satuan (Rp)', key: 'pricePerUnit', width: 20, type: 'currency' },
      { header: 'Total Nilai (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Catatan Transaksi', key: 'notes', width: 26, type: 'string' },
    ];
    const lpgRows = lpgFiltered.map((t, idx) => ({
      no: idx + 1,
      date: formatDate(t.date, 'short'),
      customerName: t.customerName,
      quantity: t.quantity,
      pricePerUnit: t.pricePerUnit,
      total: t.total,
      notes: t.notes || '-',
    }));
    const wsSales = createNeatWorksheet(
      appData.settings.companyName,
      'LOG TRANSAKSI PENJUALAN GAS LPG 3 KG',
      periodLabel,
      lpgCols,
      lpgRows,
      {
        customerName: 'TOTAL PENJUALAN LPG',
        quantity: totalCylinders,
        total: totalRevenue,
      },
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsSales, 'Penjualan LPG');

    // Sheet 3: Rekap Pelanggan
    const custCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Nama Pelanggan / Toko', key: 'name', width: 28, type: 'string' },
      { header: 'No. Telepon', key: 'phone', width: 18, type: 'string' },
      { header: 'Alamat Pangkalan', key: 'address', width: 32, type: 'string' },
      { header: 'Harga Khusus (Rp)', key: 'price', width: 20, type: 'currency' },
      { header: 'Total Transaksi', key: 'txCount', width: 16, type: 'number' },
      { header: 'Total Tabung Dibeli', key: 'totalQty', width: 18, type: 'number' },
      { header: 'Total Pembelian (Rp)', key: 'totalSpent', width: 22, type: 'currency' },
    ];
    const custRows = appData.customers.map((c, idx) => {
      const cTx = lpgFiltered.filter((t) => t.customerId === c.id);
      return {
        no: idx + 1,
        name: c.name,
        phone: c.phone || '-',
        address: c.address || '-',
        price: c.pricePerUnit,
        txCount: cTx.length,
        totalQty: cTx.reduce((s, t) => s + t.quantity, 0),
        totalSpent: cTx.reduce((s, t) => s + t.total, 0),
      };
    });
    const wsCust = createNeatWorksheet(
      appData.settings.companyName,
      'REKAPITULASI PEMBELIAN TIAP PELANGGAN',
      periodLabel,
      custCols,
      custRows,
      {
        name: 'TOTAL KESELURUHAN PELANGGAN',
        txCount: lpgFiltered.length,
        totalQty: totalCylinders,
        totalSpent: totalRevenue,
      },
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsCust, 'Rekap Pelanggan');

    // Sheet 4: Biaya Operasional LPG
    const wsExp = buildSectorExpenseSheet(
      appData.settings.companyName,
      'RINCIAN BIAYA OPERASIONAL PANGKALAN LPG',
      periodLabel,
      lpgExpenses,
      'TOTAL BIAYA OPERASIONAL LPG',
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsExp, 'Biaya Operasional LPG');

    const fileName = `Rekap_Divisi_LPG_${fileNameSuffix.replace(/\s+/g, '_')}.xlsx`;
    const result = await fileSystemService.saveExcel(wb, fileName);
    return result;
  },

  // ----------------------------------------------------
  // EKSPOR KHUSUS DIVISI EKSPEDISI / ARMADA
  // ----------------------------------------------------
  async exportExpeditionRecap(
    appData: AppData,
    expFiltered: typeof appData.expeditionTrips,
    vehExpenses: typeof appData.expenses,
    periodLabel: string,
    fileNameSuffix: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const totalRevenue = expFiltered.reduce((s, t) => s + t.totalRevenue, 0);
    const totalCost = vehExpenses.reduce((s, e) => s + e.total, 0);
    const netProfit = totalRevenue - totalCost;
    const totalDistance = expFiltered.reduce((s, t) => s + (t.distanceKm || 0), 0);
    const totalTonnage = expFiltered.reduce(
      (s, t) => s + (t.weightKg ? t.weightKg / 1000 : t.tonnage || 0),
      0
    );

    const bbmCost = vehExpenses
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + e.total, 0);
    const totalLiters = vehExpenses
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + (e.fuelDetails?.liters || 0), 0);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary Ekspedisi
    const wsSummary = createSummarySheet(
      appData.settings.companyName,
      'REKAPITULASI DIVISI EKSPEDISI & TRANSPORTASI',
      periodLabel,
      [
        { section: 'Kinerja Keuangan Armada', label: '', value: '' },
        { label: 'Total Pendapatan Jasa Ekspedisi', value: totalRevenue, isCurrency: true },
        { label: 'Total Biaya Operasional Armada', value: totalCost, isCurrency: true },
        { label: 'LABA BERSIH DIVISI EKSPEDISI', value: netProfit, isCurrency: true, isHighlight: true },
        { section: 'Beban Bahan Bakar Minyak (BBM)', label: '', value: '' },
        { label: 'Total Pengeluaran BBM Solar', value: bbmCost, isCurrency: true },
        { label: 'Total Pengeluaran Non-BBM (Servis/Ban/Oli)', value: totalCost - bbmCost, isCurrency: true },
        { label: 'Total Konsumsi Liter BBM', value: `${totalLiters.toLocaleString('id-ID')} Liter` },
        { section: 'Kapasitas & Mobilitas Armada', label: '', value: '' },
        { label: 'Total Perjalanan (Rit)', value: `${expFiltered.length} Perjalanan` },
        { label: 'Total Jarak Tempuh Armada', value: `${totalDistance.toLocaleString('id-ID')} Km` },
        { label: 'Total Tonase Muatan Diangkut', value: `${totalTonnage.toLocaleString('id-ID')} Ton` },
        { label: 'Jumlah Armada Aktif', value: `${appData.vehicles.length} Kendaraan` },
      ],
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Ekspedisi');

    // Sheet 2: Log Perjalanan Truk
    const totalWeightKg = expFiltered.reduce((s, t) => s + (t.weightKg || 0), 0);
    const totalAllowance = expFiltered.reduce((s, t) => s + (t.travelAllowance || 0), 0);
    const tripCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Plat Nomor Mobil', key: 'plateNumber', width: 16, type: 'string' },
      { header: 'Nama Driver', key: 'driver', width: 20, type: 'string' },
      { header: 'Tujuan / Rute', key: 'destination', width: 24, type: 'string' },
      { header: 'Muatan (Kg)', key: 'weightKg', width: 15, type: 'number' },
      { header: 'Tarif/Kg (Rp)', key: 'ratePerKg', width: 18, type: 'currency' },
      { header: 'Uang Jalan (Rp)', key: 'travelAllowance', width: 20, type: 'currency' },
      { header: 'Hasil Perjalanan (Rp)', key: 'totalRevenue', width: 22, type: 'currency' },
      { header: 'Keterangan Muatan', key: 'cargoNotes', width: 26, type: 'string' },
    ];
    const tripRows = expFiltered.map((t, idx) => ({
      no: idx + 1,
      date: formatDate(t.date, 'short'),
      plateNumber: t.plateNumber,
      driver: t.driver,
      destination: t.destination,
      weightKg: t.weightKg || 0,
      ratePerKg: t.ratePerKg || 0,
      travelAllowance: t.travelAllowance || 0,
      totalRevenue: t.totalRevenue,
      cargoNotes: t.cargoNotes || '-',
    }));
    const wsTrips = createNeatWorksheet(
      appData.settings.companyName,
      'LOG PERJALANAN EKSPEDISI ARMADA',
      periodLabel,
      tripCols,
      tripRows,
      {
        destination: 'TOTAL EKSPEDISI',
        weightKg: totalWeightKg,
        travelAllowance: totalAllowance,
        totalRevenue: totalRevenue,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsTrips, 'Log Perjalanan');

    // Sheet 3: Rekap Kinerja & Profitabilitas Armada per Mobil
    const vehCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Plat Kendaraan', key: 'plateNumber', width: 16, type: 'string' },
      { header: 'Nama Armada', key: 'vehicleName', width: 22, type: 'string' },
      { header: 'Driver Utama', key: 'driver', width: 18, type: 'string' },
      { header: 'Rit', key: 'trips', width: 10, type: 'number' },
      { header: 'Total Km', key: 'distanceKm', width: 14, type: 'number' },
      { header: 'Total Tonase', key: 'tonnage', width: 14, type: 'number', numFmt: DECIMAL_NUM_FMT },
      { header: 'Pendapatan (Rp)', key: 'revenue', width: 22, type: 'currency' },
      { header: 'Biaya BBM (Rp)', key: 'bbm', width: 20, type: 'currency' },
      { header: 'Servis/Lain (Rp)', key: 'other', width: 20, type: 'currency' },
      { header: 'Total Biaya Mobil (Rp)', key: 'totalCost', width: 22, type: 'currency' },
      { header: 'Laba Mobil Ini (Rp)', key: 'profit', width: 22, type: 'currency' },
    ];
    const vehRows = appData.vehicles.map((v, idx) => {
      const vTrips = expFiltered.filter((t) => t.plateNumber === v.plateNumber);
      const vRev = vTrips.reduce((s, t) => s + t.totalRevenue, 0);
      const vKm = vTrips.reduce((s, t) => s + (t.distanceKm || 0), 0);
      const vTon = vTrips.reduce(
        (s, t) => s + (t.weightKg ? t.weightKg / 1000 : t.tonnage || 0),
        0
      );

      const vExps = vehExpenses.filter((e) => e.targetPlate === v.plateNumber);
      const bbm = vExps
        .filter((e) => e.category === 'BBM')
        .reduce((s, e) => s + e.total, 0);
      const other = vExps
        .filter((e) => e.category !== 'BBM')
        .reduce((s, e) => s + e.total, 0);
      const vCost = bbm + other;
      const vProfit = vRev - vCost;

      return {
        no: idx + 1,
        plateNumber: v.plateNumber,
        vehicleName: v.vehicleName,
        driver: v.defaultDriver,
        trips: vTrips.length,
        distanceKm: vKm,
        tonnage: vTon,
        revenue: vRev,
        bbm,
        other,
        totalCost: vCost,
        profit: vProfit,
      };
    });
    const wsVehRecap = createNeatWorksheet(
      appData.settings.companyName,
      'REKAPITULASI KINERJA & PROFITABILITAS PER UNIT MOBIL',
      periodLabel,
      vehCols,
      vehRows,
      {
        driver: 'TOTAL SELURUH ARMADA',
        trips: expFiltered.length,
        distanceKm: totalDistance,
        tonnage: totalTonnage,
        revenue: totalRevenue,
        bbm: bbmCost,
        other: totalCost - bbmCost,
        totalCost: totalCost,
        profit: netProfit,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsVehRecap, 'Rekap Armada');

    // Sheet 4: Rincian Biaya Tiap Mobil (dengan format Rp otomatis untuk Harga/Liter & Total)
    const costCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Plat Kendaraan', key: 'targetPlate', width: 16, type: 'string' },
      { header: 'Kategori Biaya', key: 'category', width: 22, type: 'string' },
      { header: 'Deskripsi Pengeluaran', key: 'description', width: 34, type: 'string' },
      { header: 'Liter BBM', key: 'liters', width: 14, type: 'number' },
      { header: 'Harga/Liter (Rp)', key: 'pricePerLiter', width: 18, type: 'currency' },
      { header: 'Total Biaya (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Odometer (Km)', key: 'odometer', width: 16, type: 'number' },
      { header: 'Lokasi / SPBU', key: 'location', width: 22, type: 'string' },
      { header: 'Catatan', key: 'notes', width: 24, type: 'string' },
    ];
    const costRows = vehExpenses.map((e, idx) => ({
      no: idx + 1,
      date: formatDate(e.date, 'short'),
      targetPlate: e.targetPlate || 'Armada',
      category: e.category,
      description: e.description,
      liters: e.fuelDetails?.liters || 0,
      pricePerLiter: e.fuelDetails?.pricePerLiter || 0,
      total: e.total,
      odometer: e.fuelDetails?.odometer || 0,
      location: e.fuelDetails?.location || '-',
      notes: e.notes || '-',
    }));
    const wsCost = createNeatWorksheet(
      appData.settings.companyName,
      'RINCIAN LOG BIAYA PENGELUARAN ARMADA',
      periodLabel,
      costCols,
      costRows,
      {
        description: 'TOTAL PENGELUARAN ARMADA',
        liters: totalLiters,
        total: totalCost,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsCost, 'Rincian Biaya Armada');

    const fileName = `Rekap_Divisi_Ekspedisi_${fileNameSuffix.replace(/\s+/g, '_')}.xlsx`;
    const result = await fileSystemService.saveExcel(wb, fileName);
    return result;
  },

  // ----------------------------------------------------
  // EKSPOR REKAP SPESIFIK 1 MOBIL (MOBIL X)
  // ----------------------------------------------------
  async exportSingleVehicleRecap(
    appData: AppData,
    plateNumber: string,
    trips: typeof appData.expeditionTrips,
    expenses: typeof appData.expenses,
    periodLabel: string,
    fileNameSuffix: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const vehicle = appData.vehicles.find((v) => v.plateNumber === plateNumber);

    const totalRev = trips.reduce((s, t) => s + t.totalRevenue, 0);
    const totalCost = expenses.reduce((s, e) => s + e.total, 0);
    const netProfit = totalRev - totalCost;
    const totalKm = trips.reduce((s, t) => s + (t.distanceKm || 0), 0);
    const totalTon = trips.reduce(
      (s, t) => s + (t.weightKg ? t.weightKg / 1000 : t.tonnage || 0),
      0
    );

    const bbmCost = expenses
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + e.total, 0);
    const totalUnitLiters = expenses
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + (e.fuelDetails?.liters || 0), 0);
    const oliCost = expenses
      .filter((e) => e.category === 'Ganti Oli')
      .reduce((s, e) => s + e.total, 0);
    const banCost = expenses
      .filter((e) => e.category === 'Ganti Ban')
      .reduce((s, e) => s + e.total, 0);
    const servisCost = expenses
      .filter((e) => e.category === 'Servis Rutin')
      .reduce((s, e) => s + e.total, 0);
    const spareCost = expenses
      .filter((e) => e.category === 'Sparepart')
      .reduce((s, e) => s + e.total, 0);
    const otherCost =
      totalCost - (bbmCost + oliCost + banCost + servisCost + spareCost);

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Mobil
    const wsSummary = createSummarySheet(
      appData.settings.companyName,
      `REKAPITULASI BIAYA & PROFITABILITAS ARMADA — ${plateNumber}`,
      periodLabel,
      [
        { section: 'Identitas Kendaraan', label: '', value: '' },
        { label: 'Nomor Plat Mobil', value: plateNumber },
        {
          label: 'Jenis & Nama Armada',
          value: `${vehicle?.vehicleName || '-'} (${vehicle?.vehicleType || '-'})`,
        },
        { label: 'Driver Utama', value: vehicle?.defaultDriver || '-' },
        { section: 'Kinerja Operasional & Laba', label: '', value: '' },
        { label: 'Total Pendapatan Mobil Ini', value: totalRev, isCurrency: true },
        {
          label: 'Total Biaya Dikeluarkan untuk Mobil Ini',
          value: totalCost,
          isCurrency: true,
        },
        {
          label: 'LABA BERSIH MOBIL INI',
          value: netProfit,
          isCurrency: true,
          isHighlight: true,
        },
        { section: 'Rincian Pengeluaran Khusus Mobil Ini', label: '', value: '' },
        { label: 'Biaya BBM Solar', value: bbmCost, isCurrency: true },
        { label: 'Biaya Ganti Oli', value: oliCost, isCurrency: true },
        { label: 'Biaya Ganti Ban', value: banCost, isCurrency: true },
        { label: 'Biaya Servis Berkala', value: servisCost, isCurrency: true },
        { label: 'Biaya Sparepart / Onderdil', value: spareCost, isCurrency: true },
        { label: 'Biaya Lain-lain (Tol/Cuci/KIR)', value: otherCost, isCurrency: true },
        { section: 'Metrik Mobilitas', label: '', value: '' },
        { label: 'Total Perjalanan (Rit)', value: `${trips.length} Rit` },
        { label: 'Total Jarak Ditempuh', value: `${totalKm.toLocaleString('id-ID')} Km` },
        { label: 'Total Tonase Diangkut', value: `${totalTon.toLocaleString('id-ID')} Ton` },
      ],
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Unit');

    // Sheet 2: Log Perjalanan Mobil Ini
    const totalUnitWeightKg = trips.reduce((s, t) => s + (t.weightKg || 0), 0);
    const totalUnitAllowance = trips.reduce(
      (s, t) => s + (t.travelAllowance || 0),
      0
    );
    const tripCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Driver', key: 'driver', width: 20, type: 'string' },
      { header: 'Tujuan / Rute', key: 'destination', width: 24, type: 'string' },
      { header: 'Muatan (Kg)', key: 'weightKg', width: 15, type: 'number' },
      { header: 'Tarif/Kg (Rp)', key: 'ratePerKg', width: 18, type: 'currency' },
      { header: 'Uang Jalan (Rp)', key: 'travelAllowance', width: 20, type: 'currency' },
      { header: 'Hasil Perjalanan (Rp)', key: 'totalRevenue', width: 22, type: 'currency' },
      { header: 'Keterangan Muatan', key: 'cargoNotes', width: 26, type: 'string' },
    ];
    const tripRows = trips.map((t, idx) => ({
      no: idx + 1,
      date: formatDate(t.date, 'short'),
      driver: t.driver,
      destination: t.destination,
      weightKg: t.weightKg || 0,
      ratePerKg: t.ratePerKg || 0,
      travelAllowance: t.travelAllowance || 0,
      totalRevenue: t.totalRevenue,
      cargoNotes: t.cargoNotes || '-',
    }));
    const wsTrips = createNeatWorksheet(
      appData.settings.companyName,
      `LOG PERJALANAN MOBIL ${plateNumber}`,
      periodLabel,
      tripCols,
      tripRows,
      {
        destination: 'TOTAL MOBIL INI',
        weightKg: totalUnitWeightKg,
        travelAllowance: totalUnitAllowance,
        totalRevenue: totalRev,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsTrips, 'Log Perjalanan');

    // Sheet 3: Rincian Biaya Mobil Ini
    const expCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Kategori Biaya', key: 'category', width: 22, type: 'string' },
      { header: 'Deskripsi Biaya', key: 'description', width: 34, type: 'string' },
      { header: 'Liter BBM', key: 'liters', width: 14, type: 'number' },
      { header: 'Harga/Liter (Rp)', key: 'pricePerLiter', width: 18, type: 'currency' },
      { header: 'Total Biaya (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Odometer (Km)', key: 'odometer', width: 16, type: 'number' },
      { header: 'Lokasi / SPBU', key: 'location', width: 22, type: 'string' },
      { header: 'Catatan', key: 'notes', width: 24, type: 'string' },
    ];
    const expRows = expenses.map((e, idx) => ({
      no: idx + 1,
      date: formatDate(e.date, 'short'),
      category: e.category,
      description: e.description,
      liters: e.fuelDetails?.liters || 0,
      pricePerLiter: e.fuelDetails?.pricePerLiter || 0,
      total: e.total,
      odometer: e.fuelDetails?.odometer || 0,
      location: e.fuelDetails?.location || '-',
      notes: e.notes || '-',
    }));
    const wsExp = createNeatWorksheet(
      appData.settings.companyName,
      `RINCIAN BIAYA PERAWATAN & OPERASIONAL — ${plateNumber}`,
      periodLabel,
      expCols,
      expRows,
      {
        description: `TOTAL BIAYA MOBIL ${plateNumber}`,
        liters: totalUnitLiters,
        total: totalCost,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsExp, 'Rincian Biaya');

    const cleanPlate = plateNumber.replace(/\s+/g, '_');
    const fileName = `Rekap_Biaya_Mobil_${cleanPlate}_${fileNameSuffix.replace(/\s+/g, '_')}.xlsx`;
    const result = await fileSystemService.saveExcel(wb, fileName);
    return result;
  },

  // ----------------------------------------------------
  // EKSPOR KONSOLIDASI BULANAN — SHEET TERPISAH PER KATEGORI
  // (Ringkasan, LPG, Ekspedisi, dan Pengeluaran Umum terpisah penuh)
  // ----------------------------------------------------
  async exportMonthlyRecap(
    appData: AppData,
    lpgFiltered: typeof appData.lpgTransactions,
    expFiltered: typeof appData.expeditionTrips,
    expensesFiltered: typeof appData.expenses,
    periodLabel: string,
    fileNameSuffix: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const lpgRevenue = lpgFiltered.reduce((s, t) => s + t.total, 0);
    const expRevenue = expFiltered.reduce((s, t) => s + t.totalRevenue, 0);
    const totalRevenue = lpgRevenue + expRevenue;

    const lpgExpenseItems = expensesFiltered.filter((e) => e.sector === 'lpg');
    const expeditionExpenseItems = expensesFiltered.filter(
      (e) => e.sector === 'expedition'
    );
    const generalExpenseItems = expensesFiltered.filter(
      (e) => e.sector === 'general'
    );

    const lpgExpenses = lpgExpenseItems.reduce((s, e) => s + e.total, 0);
    const expeditionExpenses = expeditionExpenseItems.reduce(
      (s, e) => s + e.total,
      0
    );
    const generalExpenses = generalExpenseItems.reduce(
      (s, e) => s + e.total,
      0
    );
    const totalExpenses = lpgExpenses + expeditionExpenses + generalExpenses;
    const netProfit = totalRevenue - totalExpenses;

    const totalCylinders = lpgFiltered.reduce((s, t) => s + t.quantity, 0);
    const totalDistance = expFiltered.reduce(
      (s, t) => s + (t.distanceKm || 0),
      0
    );
    const totalTonnage = expFiltered.reduce(
      (s, t) => s + (t.weightKg ? t.weightKg / 1000 : t.tonnage || 0),
      0
    );

    const wb = XLSX.utils.book_new();

    // Sheet 1: Ringkasan Eksekutif Konsolidasi
    const wsSummary = createSummarySheet(
      appData.settings.companyName,
      'LAPORAN REKAPITULASI KEUANGAN KONSOLIDASI',
      periodLabel,
      [
        { section: '1. PENDAPATAN USAHA (REVENUE)', label: '', value: '' },
        { label: 'Pendapatan Penjualan Gas LPG 3 Kg', value: lpgRevenue, isCurrency: true },
        {
          label: 'Pendapatan Jasa Ekspedisi / Transportasi',
          value: expRevenue,
          isCurrency: true,
        },
        {
          label: 'TOTAL PENDAPATAN PERUSAHAAN',
          value: totalRevenue,
          isCurrency: true,
          isHighlight: true,
        },
        { section: '2. PENGELUARAN OPERASIONAL PER KATEGORI', label: '', value: '' },
        {
          label: 'Kategori LPG — Biaya Operasional Pangkalan',
          value: lpgExpenses,
          isCurrency: true,
        },
        {
          label: 'Kategori Ekspedisi — Beban Armada & BBM',
          value: expeditionExpenses,
          isCurrency: true,
        },
        {
          label: 'Kategori Pengeluaran Umum — Overhead Kantor',
          value: generalExpenses,
          isCurrency: true,
        },
        {
          label: 'TOTAL PENGELUARAN OPERASIONAL',
          value: totalExpenses,
          isCurrency: true,
          isHighlight: true,
        },
        { section: '3. HASIL USAHA PER DIVISI & KONSOLIDASI', label: '', value: '' },
        { label: 'Laba Operasional Divisi LPG', value: lpgRevenue - lpgExpenses, isCurrency: true },
        {
          label: 'Laba Operasional Divisi Ekspedisi',
          value: expRevenue - expeditionExpenses,
          isCurrency: true,
        },
        {
          label: 'LABA BERSIH KONSOLIDASI PERUSAHAAN',
          value: netProfit,
          isCurrency: true,
          isHighlight: true,
        },
        { section: '4. METRIK OPERASIONAL PERIODE INI', label: '', value: '' },
        {
          label: 'Total Tabung LPG Terjual',
          value: `${totalCylinders.toLocaleString('id-ID')} Tabung`,
        },
        {
          label: 'Jumlah Transaksi Penjualan LPG',
          value: `${lpgFiltered.length} Transaksi`,
        },
        {
          label: 'Total Perjalanan Ekspedisi',
          value: `${expFiltered.length} Rit`,
        },
        {
          label: 'Total Jarak Tempuh Armada',
          value: `${totalDistance.toLocaleString('id-ID')} Km`,
        },
        {
          label: 'Total Tonase Muatan Diangkut',
          value: `${totalTonnage.toLocaleString('id-ID')} Ton`,
        },
      ],
      'consolidation'
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Bulanan');

    // ====================================================
    // KATEGORI 1: DIVISI LPG (Penjualan, Biaya LPG, Pelanggan)
    // ====================================================
    const lpgCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Pelanggan / Pangkalan', key: 'customerName', width: 28, type: 'string' },
      { header: 'Jumlah Tabung', key: 'quantity', width: 16, type: 'number' },
      { header: 'Harga Satuan (Rp)', key: 'pricePerUnit', width: 20, type: 'currency' },
      { header: 'Total Nilai (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Catatan', key: 'notes', width: 24, type: 'string' },
    ];
    const lpgRows = lpgFiltered.map((t, idx) => ({
      no: idx + 1,
      date: formatDate(t.date, 'short'),
      customerName: t.customerName,
      quantity: t.quantity,
      pricePerUnit: t.pricePerUnit,
      total: t.total,
      notes: t.notes || '-',
    }));
    const wsLpgSales = createNeatWorksheet(
      appData.settings.companyName,
      'KATEGORI LPG — LOG TRANSAKSI PENJUALAN LPG 3 KG',
      periodLabel,
      lpgCols,
      lpgRows,
      {
        customerName: 'TOTAL PENJUALAN LPG',
        quantity: totalCylinders,
        total: lpgRevenue,
      },
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsLpgSales, 'Penjualan LPG');

    // Sheet Khusus Biaya Operasional Kategori LPG
    const wsLpgExp = buildSectorExpenseSheet(
      appData.settings.companyName,
      'KATEGORI LPG — RINCIAN PENGELUARAN OPERASIONAL PANGKALAN',
      periodLabel,
      lpgExpenseItems,
      'TOTAL PENGELUARAN KATEGORI LPG',
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsLpgExp, 'Pengeluaran LPG');

    // Sheet Rekap Pelanggan LPG
    const custCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Nama Pelanggan', key: 'name', width: 28, type: 'string' },
      { header: 'Telepon', key: 'phone', width: 18, type: 'string' },
      { header: 'Alamat', key: 'address', width: 30, type: 'string' },
      { header: 'Harga Khusus (Rp)', key: 'price', width: 20, type: 'currency' },
      { header: 'Total Transaksi', key: 'txCount', width: 16, type: 'number' },
      { header: 'Total Tabung', key: 'totalQty', width: 16, type: 'number' },
      { header: 'Total Pembelian (Rp)', key: 'totalSpent', width: 22, type: 'currency' },
    ];
    const custRows = appData.customers.map((c, idx) => {
      const cTx = lpgFiltered.filter((t) => t.customerId === c.id);
      return {
        no: idx + 1,
        name: c.name,
        phone: c.phone || '-',
        address: c.address || '-',
        price: c.pricePerUnit,
        txCount: cTx.length,
        totalQty: cTx.reduce((s, t) => s + t.quantity, 0),
        totalSpent: cTx.reduce((s, t) => s + t.total, 0),
      };
    });
    const wsCust = createNeatWorksheet(
      appData.settings.companyName,
      'KATEGORI LPG — REKAPITULASI PELANGGAN GAS LPG',
      periodLabel,
      custCols,
      custRows,
      {
        name: 'TOTAL KESELURUHAN PELANGGAN',
        txCount: lpgFiltered.length,
        totalQty: totalCylinders,
        totalSpent: lpgRevenue,
      },
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsCust, 'Rekap Pelanggan');

    // ====================================================
    // KATEGORI 2: DIVISI EKSPEDISI (Perjalanan, Biaya Armada, Rekap Kendaraan)
    // ====================================================
    const totalMonthWeightKg = expFiltered.reduce(
      (s, t) => s + (t.weightKg || 0),
      0
    );
    const totalMonthAllowance = expFiltered.reduce(
      (s, t) => s + (t.travelAllowance || 0),
      0
    );
    const expCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Plat Nomor Mobil', key: 'plateNumber', width: 16, type: 'string' },
      { header: 'Driver', key: 'driver', width: 20, type: 'string' },
      { header: 'Tujuan / Rute', key: 'destination', width: 24, type: 'string' },
      { header: 'Muatan (Kg)', key: 'weightKg', width: 15, type: 'number' },
      { header: 'Tarif/Kg (Rp)', key: 'ratePerKg', width: 18, type: 'currency' },
      { header: 'Uang Jalan (Rp)', key: 'travelAllowance', width: 20, type: 'currency' },
      { header: 'Hasil Perjalanan (Rp)', key: 'totalRevenue', width: 22, type: 'currency' },
      { header: 'Keterangan Muatan', key: 'cargoNotes', width: 24, type: 'string' },
    ];
    const expRows = expFiltered.map((t, idx) => ({
      no: idx + 1,
      date: formatDate(t.date, 'short'),
      plateNumber: t.plateNumber,
      driver: t.driver,
      destination: t.destination,
      weightKg: t.weightKg || 0,
      ratePerKg: t.ratePerKg || 0,
      travelAllowance: t.travelAllowance || 0,
      totalRevenue: t.totalRevenue,
      cargoNotes: t.cargoNotes || '-',
    }));
    const wsExp = createNeatWorksheet(
      appData.settings.companyName,
      'KATEGORI EKSPEDISI — LOG PERJALANAN ARMADA',
      periodLabel,
      expCols,
      expRows,
      {
        destination: 'TOTAL PERJALANAN EKSPEDISI',
        weightKg: totalMonthWeightKg,
        travelAllowance: totalMonthAllowance,
        totalRevenue: expRevenue,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsExp, 'Perjalanan Ekspedisi');

    // Sheet Khusus Biaya Armada (Kategori Ekspedisi)
    const totalBbmAll = expeditionExpenseItems
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + e.total, 0);
    const totalLitersAll = expeditionExpenseItems
      .filter((e) => e.category === 'BBM')
      .reduce((s, e) => s + (e.fuelDetails?.liters || 0), 0);

    const vehExpCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Plat Mobil', key: 'targetPlate', width: 16, type: 'string' },
      { header: 'Kategori Biaya', key: 'category', width: 22, type: 'string' },
      { header: 'Deskripsi Biaya', key: 'description', width: 34, type: 'string' },
      { header: 'Liter BBM', key: 'liters', width: 14, type: 'number' },
      { header: 'Harga/Liter (Rp)', key: 'pricePerLiter', width: 18, type: 'currency' },
      { header: 'Total Biaya (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Odometer (Km)', key: 'odometer', width: 16, type: 'number' },
      { header: 'Lokasi / SPBU', key: 'location', width: 22, type: 'string' },
      { header: 'Catatan', key: 'notes', width: 24, type: 'string' },
    ];
    const vehExpRows = expeditionExpenseItems.map((e, idx) => ({
      no: idx + 1,
      date: formatDate(e.date, 'short'),
      targetPlate: e.targetPlate || 'Armada',
      category: e.category,
      description: e.description,
      liters: e.fuelDetails?.liters || 0,
      pricePerLiter: e.fuelDetails?.pricePerLiter || 0,
      total: e.total,
      odometer: e.fuelDetails?.odometer || 0,
      location: e.fuelDetails?.location || '-',
      notes: e.notes || '-',
    }));
    const wsVehExp = createNeatWorksheet(
      appData.settings.companyName,
      'KATEGORI EKSPEDISI — RINCIAN BIAYA OPERASIONAL & BBM ARMADA',
      periodLabel,
      vehExpCols,
      vehExpRows,
      {
        description: 'TOTAL PENGELUARAN EKSPEDISI',
        liters: totalLitersAll,
        total: expeditionExpenses,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsVehExp, 'Pengeluaran Ekspedisi');

    // Sheet Rekap Kinerja & Profitabilitas Armada
    const vehCols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Plat Kendaraan', key: 'plateNumber', width: 16, type: 'string' },
      { header: 'Nama Armada', key: 'vehicleName', width: 22, type: 'string' },
      { header: 'Driver', key: 'driver', width: 18, type: 'string' },
      { header: 'Rit', key: 'trips', width: 10, type: 'number' },
      { header: 'Total Km', key: 'distanceKm', width: 14, type: 'number' },
      { header: 'Total Ton', key: 'tonnage', width: 14, type: 'number', numFmt: DECIMAL_NUM_FMT },
      { header: 'Pendapatan (Rp)', key: 'revenue', width: 22, type: 'currency' },
      { header: 'Biaya BBM (Rp)', key: 'bbm', width: 20, type: 'currency' },
      { header: 'Servis/Lain (Rp)', key: 'other', width: 20, type: 'currency' },
      { header: 'Total Biaya (Rp)', key: 'totalCost', width: 22, type: 'currency' },
      { header: 'Laba Mobil Ini (Rp)', key: 'profit', width: 22, type: 'currency' },
    ];
    const vehRows = appData.vehicles.map((v, idx) => {
      const vTrips = expFiltered.filter((t) => t.plateNumber === v.plateNumber);
      const vRev = vTrips.reduce((s, t) => s + t.totalRevenue, 0);
      const vKm = vTrips.reduce((s, t) => s + (t.distanceKm || 0), 0);
      const vTon = vTrips.reduce(
        (s, t) => s + (t.weightKg ? t.weightKg / 1000 : t.tonnage || 0),
        0
      );

      const vExps = expeditionExpenseItems.filter(
        (e) => e.targetPlate === v.plateNumber
      );
      const bbm = vExps
        .filter((e) => e.category === 'BBM')
        .reduce((s, e) => s + e.total, 0);
      const other = vExps
        .filter((e) => e.category !== 'BBM')
        .reduce((s, e) => s + e.total, 0);
      const vCost = bbm + other;
      const vProf = vRev - vCost;

      return {
        no: idx + 1,
        plateNumber: v.plateNumber,
        vehicleName: v.vehicleName,
        driver: v.defaultDriver,
        trips: vTrips.length,
        distanceKm: vKm,
        tonnage: vTon,
        revenue: vRev,
        bbm,
        other,
        totalCost: vCost,
        profit: vProf,
      };
    });
    const wsVeh = createNeatWorksheet(
      appData.settings.companyName,
      'KATEGORI EKSPEDISI — REKAPITULASI KINERJA PER KENDARAAN',
      periodLabel,
      vehCols,
      vehRows,
      {
        driver: 'TOTAL KESELURUHAN ARMADA',
        trips: expFiltered.length,
        distanceKm: totalDistance,
        tonnage: totalTonnage,
        revenue: expRevenue,
        bbm: totalBbmAll,
        other: expeditionExpenses - totalBbmAll,
        totalCost: expeditionExpenses,
        profit: expRevenue - expeditionExpenses,
      },
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsVeh, 'Rekap Kendaraan');

    // ====================================================
    // KATEGORI 3: PENGELUARAN UMUM (Overhead Kantor & Administrasi)
    // ====================================================
    const wsGeneralExp = buildSectorExpenseSheet(
      appData.settings.companyName,
      'KATEGORI PENGELUARAN UMUM — BEBAN OPERASIONAL KANTOR & ADMINISTRASI',
      periodLabel,
      generalExpenseItems,
      'TOTAL PENGELUARAN UMUM KANTOR',
      'general'
    );
    XLSX.utils.book_append_sheet(wb, wsGeneralExp, 'Pengeluaran Umum');

    const fileName = `Rekap_Keuangan_Konsolidasi_${fileNameSuffix.replace(/\s+/g, '_')}.xlsx`;
    const result = await fileSystemService.saveExcel(wb, fileName);
    return result;
  },

  // ----------------------------------------------------
  // EKSPOR KHUSUS PENGELUARAN TERPISAH PER KATEGORI
  // (Sheet terpisah: LPG, Ekspedisi, dan Pengeluaran Umum)
  // ----------------------------------------------------
  async exportExpensesByCategory(
    appData: AppData,
    expensesFiltered: Expense[],
    periodLabel: string,
    fileNameSuffix: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const lpgExp = expensesFiltered.filter((e) => e.sector === 'lpg');
    const expeditionExp = expensesFiltered.filter((e) => e.sector === 'expedition');
    const generalExp = expensesFiltered.filter((e) => e.sector === 'general');

    const totalLpg = lpgExp.reduce((s, e) => s + e.total, 0);
    const totalExpedition = expeditionExp.reduce((s, e) => s + e.total, 0);
    const totalGeneral = generalExp.reduce((s, e) => s + e.total, 0);
    const grandTotal = totalLpg + totalExpedition + totalGeneral;

    const wb = XLSX.utils.book_new();

    const wsSummary = createSummarySheet(
      appData.settings.companyName,
      'REKAPITULASI PENGELUARAN PER KATEGORI DIVISI',
      periodLabel,
      [
        { section: 'Rincian Beban per Kategori', label: '', value: '' },
        { label: '1. Kategori LPG (Beban Pangkalan)', value: totalLpg, isCurrency: true },
        { label: '2. Kategori Ekspedisi (Beban Armada & BBM)', value: totalExpedition, isCurrency: true },
        { label: '3. Kategori Pengeluaran Umum (Kantor & Admin)', value: totalGeneral, isCurrency: true },
        { label: 'TOTAL SELURUH PENGELUARAN', value: grandTotal, isCurrency: true, isHighlight: true },
      ],
      'consolidation'
    );
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Ringkasan Biaya');

    const wsLpg = buildSectorExpenseSheet(
      appData.settings.companyName,
      'KATEGORI LPG — PENGELUARAN PANGKALAN LPG',
      periodLabel,
      lpgExp,
      'TOTAL PENGELUARAN LPG',
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, wsLpg, 'LPG');

    const wsExp = buildSectorExpenseSheet(
      appData.settings.companyName,
      'KATEGORI EKSPEDISI — PENGELUARAN ARMADA & BBM',
      periodLabel,
      expeditionExp,
      'TOTAL PENGELUARAN EKSPEDISI',
      'expedition'
    );
    XLSX.utils.book_append_sheet(wb, wsExp, 'Ekspedisi');

    const wsGen = buildSectorExpenseSheet(
      appData.settings.companyName,
      'KATEGORI PENGELUARAN UMUM — OVERHEAD KANTOR',
      periodLabel,
      generalExp,
      'TOTAL PENGELUARAN UMUM',
      'general'
    );
    XLSX.utils.book_append_sheet(wb, wsGen, 'Pengeluaran Umum');

    const fileName = `Rekap_Pengeluaran_Per_Kategori_${fileNameSuffix.replace(/\s+/g, '_')}.xlsx`;
    return fileSystemService.saveExcel(wb, fileName);
  },

  async exportCustomerTransactions(
    appData: AppData,
    customer: Customer,
    transactions: LpgTransaction[],
    periodLabel: string
  ): Promise<{ fileName: string; folderName?: string; mode: 'filesystem' | 'download' }> {
    const totalQty = transactions.reduce((s, t) => s + t.quantity, 0);
    const totalAmount = transactions.reduce((s, t) => s + t.total, 0);

    const wb = XLSX.utils.book_new();

    const cols: ColumnDef[] = [
      { header: 'No', key: 'no', width: 6, type: 'number' },
      { header: 'Tanggal', key: 'date', width: 14, type: 'date' },
      { header: 'Nama Pelanggan', key: 'customerName', width: 24, type: 'string' },
      { header: 'Produk LPG', key: 'productType', width: 22, type: 'string' },
      { header: 'Jumlah Tabung', key: 'quantity', width: 15, type: 'number' },
      { header: 'Harga Satuan (Rp)', key: 'pricePerUnit', width: 20, type: 'currency' },
      { header: 'Total Nilai (Rp)', key: 'total', width: 22, type: 'currency' },
      { header: 'Status Pembayaran', key: 'paymentStatus', width: 20, type: 'string' },
      { header: 'Catatan', key: 'notes', width: 26, type: 'string' },
    ];

    const rows = transactions.map((tx, idx) => ({
      no: idx + 1,
      date: formatDate(tx.date, 'short'),
      customerName: tx.customerName,
      productType: tx.productType || '-',
      quantity: tx.quantity,
      pricePerUnit: tx.pricePerUnit,
      total: tx.total,
      paymentStatus: tx.paymentStatus || '-',
      notes: tx.notes || '-',
    }));

    const safeCustName = customer?.name || 'PELANGGAN';
    const ws = createNeatWorksheet(
      appData.settings?.companyName,
      `HISTORI TRANSAKSI PELANGGAN — ${safeCustName.toUpperCase()}`,
      `Periode: ${periodLabel} • Telp: ${customer?.phone || '-'} • Alamat: ${customer?.address || '-'}`,
      cols,
      rows,
      {
        customerName: 'TOTAL TRANSAKSI PELANGGAN',
        quantity: totalQty,
        total: totalAmount,
      },
      'lpg'
    );
    XLSX.utils.book_append_sheet(wb, ws, 'Histori Transaksi');

    const cleanCustName = customer.name.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `Rekap_Pelanggan_${cleanCustName}_${new Date().toISOString().slice(0, 10)}.xlsx`;
    const result = await fileSystemService.saveExcel(wb, fileName);
    return result;
  },
};
