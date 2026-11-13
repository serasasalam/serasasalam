import { getAccessToken } from './auth';

export const DEFAULT_SERASA_SALAM_SPREADSHEET_ID =
  '1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI';
export const DEFAULT_SERASA_SALAM_URL =
  'https://docs.google.com/spreadsheets/d/1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI/edit?usp=sharing';

export type ConnectionMode = 'gas' | 'public_link' | 'oauth';

export interface SheetTabInfo {
  sheetId: number;
  title: string;
  index: number;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  locale: string;
  timeZone: string;
  spreadsheetUrl: string;
  sheets: SheetTabInfo[];
  connectionMode?: ConnectionMode;
  scriptUrl?: string;
}

export interface ColumnSchema {
  index: number;
  letter: string;
  name: string;
  inferredType: 'date' | 'currency' | 'number' | 'select' | 'autonumber' | 'invoice' | 'text';
  isFormulaColumn: boolean; // True for "Kolom Biru" (auto-calculated by spreadsheet formulas)
  uniqueValues: string[];
  nextAutoNumber?: number;
  nextInvoiceCode?: string;
}

export interface SheetDataResult {
  sheetTitle: string;
  headerRow1Based: number;
  nextInsertRow1Based: number; // Exact 1-based row number for the next new entry (e.g. Row 44 in Tracker Closing)
  headers: string[];
  columns: ColumnSchema[];
  rows: {
    rowNumber1Based: number;
    values: string[];
  }[];
  rawValues: string[][];
}

export interface SerasaTabRule {
  headerRow1Based: number;
  maxColumns?: number;
  formulaColIndices: number[]; // 0-based indices of blue formula columns (never overwrite in sheet)
  requiredInputColIndices: number[]; // 0-based indices that must have at least 1 non-empty value for a row to be active
  presetOptions?: Record<string, string[]>;
  description: string;
}

/**
 * Exact tab rules tailored to "Serasa Salam New Concept x Bisnis"
 */
export const SERASA_TAB_RULES: Record<string, SerasaTabRule> = {
  'Tracker Closing': {
    headerRow1Based: 1,
    maxColumns: 21, // Columns A to U
    formulaColIndices: [10, 13, 15], // K (Subtotal), N (Total Tagihan), P (Sisa)
    requiredInputColIndices: [0, 1, 2], // No. Invoice, Tanggal Lead, Nama Klien
    description:
      'Pusat data seluruh lead & order undangan cetak maupun digital. Kolom kuning diisi manual; kolom biru (Subtotal, Total Tagihan, Sisa) dihitung otomatis oleh rumus Sheet.',
    presetOptions: {
      'Jenis Acara': ['Wedding', 'Khitanan', 'Aqiqah', 'Tunangan', 'Lainnya'],
      Channel: ['WhatsApp', 'Instagram', 'TikTok', 'Mitra', 'Lainnya'],
      Paket: [
        'Undangan Cetak Basic',
        'Undangan Cetak Premium',
        'Undangan Digital',
        'Kartu Souvenir',
        'Eksklusif',
      ],
      'Metode Bayar': ['Transfer', 'Cash', 'QRIS'],
      Status: [
        'Menunggu DP',
        'Desain',
        'Revisi',
        'Cetak',
        'Finishing',
        'Dikirim',
        'Selesai',
      ],
    },
  },
  'PO Ganci': {
    headerRow1Based: 1,
    maxColumns: 10, // Columns A to J (ignores side summary tables in K+)
    formulaColIndices: [7], // H (Total = Harga * QTY)
    requiredInputColIndices: [0, 1], // Tgl PO, Nama Order
    description:
      'Catatan pesanan (PO) gantungan kunci: tema, warna, teks, harga, dan status.',
    presetOptions: {
      Tema: [
        'Inisial Contour',
        'Inisial Polos',
        'KC2',
        'KC3',
        'KC5',
        'KC7',
        'KC8',
        'KC9',
        'KP2',
        'KP3',
        'KP5',
      ],
      Warna: [
        'Sesuai Tema',
        '1. Biru',
        '1. Biru Muda',
        '2. Magenta',
        '3. Orange',
        '4. Hijau',
        '5. Ungu',
        '6. Hijau',
        '10. Coklat Muda',
      ],
      Bayar: ['LUNAS', 'Belum Bayar'],
      Status: ['PO', 'Selesai'],
    },
  },
  'Pemasukan Diluar Undangan': {
    headerRow1Based: 1,
    maxColumns: 4, // Columns A to D (ignores side RINGKASAN in F-G)
    formulaColIndices: [],
    requiredInputColIndices: [0, 1, 2],
    description:
      'Pencatatan pemasukan kas di luar order undangan (beserta tipe bayar Transfer/Cash).',
    presetOptions: {
      'Tipe Bayar': ['Transfer', 'Cash'],
    },
  },
  Pengeluaran: {
    headerRow1Based: 1,
    maxColumns: 4, // Columns A to D (ignores side RINGKASAN in F-G)
    formulaColIndices: [],
    requiredInputColIndices: [0, 1, 2],
    description:
      'Pencatatan seluruh pengeluaran operasional & belanja bahan usaha Serasa Salam.',
    presetOptions: {
      'Tipe Bayar': ['Transfer', 'Cash'],
    },
  },
  'Tracker Mitra': {
    headerRow1Based: 5,
    maxColumns: 14, // Columns A to N
    formulaColIndices: [8, 9, 10, 12], // I (Jumlah Baris Order), J (Omzet Selesai), K (Komisi Terutang), M (Sisa Komisi)
    requiredInputColIndices: [0, 1], // Kode Mitra, Nama Mitra
    description:
      'Data Reseller & Affiliate. Order dan komisi dihitung otomatis dari Kode Mitra di Tracker Closing.',
    presetOptions: {
      Tipe: ['Reseller', 'Affiliate'],
      Tier: ['Basic', 'Silver', 'Gold'],
      Status: ['Aktif', 'Nonaktif'],
    },
  },
};

export class SheetsApiError extends Error {
  status: number;
  isAuthError: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SheetsApiError';
    this.status = status;
    this.isAuthError = status === 401 || status === 403;
  }
}

/**
 * Ready-to-paste Google Apps Script code tailored specifically for Serasa Salam Undangan
 * (`1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI`).
 * Writes only to yellow input columns and preserves blue formula columns!
 */
export const APPS_SCRIPT_BRIDGE_CODE = `// JEMBATAN SINKRONISASI 2 ARAH — SERASA SALAM UNDANGAN
// Spreadsheet ID: 1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI
//
// Cara Pasang (Hanya 1 Menit):
// 1. Di Google Spreadsheet Serasa Salam, klik menu atas: "Ekstensi" (Extensions) -> "Apps Script"
// 2. Hapus kode lama di Code.gs, tempel (Paste) seluruh kode ini, lalu tekan Ctrl+S (Simpan)
// 3. Klik tombol biru "Terapkan" (Deploy) di kanan atas -> "Deployment baru" (New deployment)
// 4. Pilih jenis: "Aplikasi web" (Web app)
// 5. Jalankan sebagai: "Saya" (Me) | Siapa yang memiliki akses: "Siapa saja" (Anyone)
// 6. Klik "Terapkan" (Deploy), klik "Izinkan akses", lalu salin URL Web App (/exec) ke aplikasi!

var DEFAULT_SHEET_ID = "1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI";

function getTargetSpreadsheet(data) {
  var id = (data && data.spreadsheetId) ? data.spreadsheetId : DEFAULT_SHEET_ID;
  try {
    return SpreadsheetApp.openById(id);
  } catch (e) {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
}

function doGet(e) {
  return handleRequest({ action: 'getMetadata' });
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || '{}');
    return handleRequest(body);
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function handleRequest(body) {
  try {
    var ss = getTargetSpreadsheet(body);
    if (!ss) return jsonResponse({ ok: false, error: 'Spreadsheet tidak ditemukan.' });
    var action = body.action || 'getMetadata';

    if (action === 'getMetadata') {
      var sheets = ss.getSheets().map(function(s, idx) {
        return {
          sheetId: s.getSheetId(),
          title: s.getName(),
          index: idx,
          rowCount: s.getMaxRows(),
          columnCount: s.getMaxColumns()
        };
      });
      return jsonResponse({
        ok: true,
        spreadsheetId: ss.getId(),
        title: ss.getName(),
        locale: ss.getSpreadsheetLocale() || 'id_ID',
        timeZone: ss.getSpreadsheetTimeZone() || 'Asia/Jakarta',
        spreadsheetUrl: ss.getUrl(),
        sheets: sheets
      });
    }

    if (action === 'getSheetValues') {
      var sheet = ss.getSheetByName(body.sheetTitle) || ss.getSheets()[0];
      var values = sheet.getDataRange().getDisplayValues();
      return jsonResponse({ ok: true, values: values });
    }

    // Write row to specific rowNumber1Based while preserving formula columns (Kolom Biru)
    if (action === 'writeRow' || action === 'appendRow' || action === 'updateRow') {
      var sheet = ss.getSheetByName(body.sheetTitle);
      if (!sheet) return jsonResponse({ ok: false, error: 'Tab tidak ditemukan: ' + body.sheetTitle });

      var targetRow = Number(body.rowNumber1Based || 0);
      var vals = body.values || [];
      var formulaCols = body.formulaColIndices || [];

      if (!targetRow || targetRow < 1) {
        sheet.appendRow(vals);
      } else {
        for (var c = 0; c < vals.length; c++) {
          // Jangan timpa kolom rumus otomatis (Kolom Biru)
          if (formulaCols.indexOf(c) !== -1) continue;
          sheet.getRange(targetRow, c + 1).setValue(vals[c]);
        }
      }
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true, rowNumber1Based: targetRow });
    }

    if (action === 'deleteRow') {
      var sheet = ss.getSheetByName(body.sheetTitle);
      if (!sheet) return jsonResponse({ ok: false, error: 'Tab tidak ditemukan: ' + body.sheetTitle });
      var rowNum = Number(body.rowNumber1Based);
      var formulaCols = body.formulaColIndices || [];
      var maxCol = Number(body.maxColumns || sheet.getLastColumn());

      // Jika tab memiliki kolom rumus otomatis di setiap baris (seperti Tracker Closing),
      // kosongkan sel input kuning saja agar rumus biru tidak hilang
      if (formulaCols.length > 0) {
        for (var col = 0; col < maxCol; col++) {
          if (formulaCols.indexOf(col) !== -1) continue;
          sheet.getRange(rowNum, col + 1).clearContent();
        }
      } else {
        sheet.deleteRow(rowNum);
      }
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true });
    }

    if (action === 'createSheetTab') {
      var newSheet = ss.insertSheet(body.tabTitle);
      if (body.initialHeaders && body.initialHeaders.length > 0) {
        newSheet.getRange(1, 1, 1, body.initialHeaders.length).setValues([body.initialHeaders]);
      }
      SpreadsheetApp.flush();
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ ok: false, error: 'Action tidak dikenal: ' + action });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

export function extractSpreadsheetId(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return '';

  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1];
  }

  const idParamMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
  if (idParamMatch && idParamMatch[1]) {
    return idParamMatch[1];
  }

  return trimmed;
}

export function isAppsScriptUrl(input: string): boolean {
  return input.trim().startsWith('https://script.google.com/');
}

async function callGasProxy(scriptUrl: string, payload: Record<string, any>): Promise<any> {
  const res = await fetch('/api/gas-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scriptUrl: scriptUrl.trim(), payload }),
  });

  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new SheetsApiError(
      data.error || `Gagal menghubungi Google Apps Script (Status ${res.status})`,
      res.status
    );
  }
  return data;
}

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<any> {
  const token = await getAccessToken();
  if (!token) {
    throw new SheetsApiError(
      'Untuk menyimpan perubahan ke Google Spreadsheet tanpa Login OAuth (Bebas Blokir 403), silakan pasang URL Web App Google Apps Script pada tombol "Aktifkan Simpan 2 Arah (Apps Script)".',
      401
    );
  }

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    let errorDetail = '';
    try {
      const errJson = await response.json();
      errorDetail = errJson?.error?.message || '';
    } catch {
      errorDetail = response.statusText;
    }

    throw new SheetsApiError(
      errorDetail || `Gagal menghubungi Google Sheets API (Status ${response.status})`,
      response.status
    );
  }

  if (response.status === 204) return null;
  return response.json();
}

export async function getSpreadsheetMetadata(
  spreadsheetIdOrUrl: string,
  scriptUrl?: string
): Promise<SpreadsheetMetadata> {
  const cleanScriptUrl = (scriptUrl || '').trim();
  const maybeScriptInInput = isAppsScriptUrl(spreadsheetIdOrUrl)
    ? spreadsheetIdOrUrl.trim()
    : cleanScriptUrl;
  const extractedSheetId = isAppsScriptUrl(spreadsheetIdOrUrl)
    ? DEFAULT_SERASA_SALAM_SPREADSHEET_ID
    : extractSpreadsheetId(spreadsheetIdOrUrl) || DEFAULT_SERASA_SALAM_SPREADSHEET_ID;

  // 1. Mode: Google Apps Script Bridge (No OAuth required, 100% 2-way read/write)
  if (maybeScriptInInput) {
    const data = await callGasProxy(maybeScriptInInput, {
      action: 'getMetadata',
      spreadsheetId: extractedSheetId,
    });
    const priorityOrder = [
      'Tracker Closing',
      'PO Ganci',
      'Pemasukan Diluar Undangan',
      'Pengeluaran',
      'Tracker Mitra',
      'Paket Harga',
      'Dashboard',
      'INVOICE',
    ];
    const sortedSheets = [...(data.sheets || [])].sort((a: SheetTabInfo, b: SheetTabInfo) => {
      const idxA = priorityOrder.indexOf(a.title);
      const idxB = priorityOrder.indexOf(b.title);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.index - b.index;
    });

    return {
      spreadsheetId: data.spreadsheetId || extractedSheetId,
      title: data.title || 'Serasa Salam New Concept x Bisnis',
      locale: data.locale || 'id_ID',
      timeZone: data.timeZone || 'Asia/Jakarta',
      spreadsheetUrl:
        data.spreadsheetUrl ||
        `https://docs.google.com/spreadsheets/d/${extractedSheetId}/edit`,
      sheets: sortedSheets,
      connectionMode: 'gas',
      scriptUrl: maybeScriptInInput,
    };
  }

  // 2. Mode: Direct Public/Shared Link Reader (Instant load without OAuth block!)
  const res = await fetch(
    `/api/public-sheet/meta?spreadsheetId=${encodeURIComponent(extractedSheetId)}`
  );
  const data = await res.json();
  if (!res.ok) {
    throw new SheetsApiError(
      data.error || 'Gagal membaca spreadsheet melalui link.',
      res.status
    );
  }

  const token = await getAccessToken();
  return {
    ...data,
    connectionMode: token ? 'oauth' : 'public_link',
  };
}

export function columnIndexToLetter(index: number): string {
  let temp = index;
  let letter = '';
  while (temp >= 0) {
    letter = String.fromCharCode((temp % 26) + 65) + letter;
    temp = Math.floor(temp / 26) - 1;
  }
  return letter;
}

export function parseNumericCell(val: string): number | null {
  if (!val) return null;
  const cleaned = val.trim();
  if (!cleaned) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned) || /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cleaned)) {
    return null;
  }
  if (/^(\+62|62|08|8)\d{8,13}$/.test(cleaned.replace(/[\s\-]/g, ''))) {
    return null;
  }

  let numStr = cleaned.replace(/[Rp$€£\s]/gi, '');
  if (!numStr || !/^[+-]?[\d.,]+$/.test(numStr)) return null;

  if (/^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/.test(numStr)) {
    numStr = numStr.replace(/\./g, '').replace(',', '.');
  } else if (/^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/.test(numStr)) {
    numStr = numStr.replace(/,/g, '');
  } else if (numStr.includes(',') && !numStr.includes('.')) {
    numStr = numStr.replace(',', '.');
  }

  const parsed = Number(numStr);
  return Number.isFinite(parsed) ? parsed : null;
}

export function detectBestHeaderRow(rawValues: string[][], sheetTitle?: string): number {
  if (sheetTitle && SERASA_TAB_RULES[sheetTitle]) {
    return SERASA_TAB_RULES[sheetTitle].headerRow1Based;
  }
  if (rawValues.length === 0) return 1;
  let bestRowIndex = 0;
  let bestScore = -1;

  const limit = Math.min(rawValues.length, 6);
  for (let r = 0; r < limit; r++) {
    const row = rawValues[r] || [];
    const nonEmptyCount = row.filter((c) => c && String(c).trim().length > 0).length;
    if (nonEmptyCount === 0) continue;
    const textCells = row.filter((c) => {
      const s = String(c || '').trim();
      return s.length > 0 && parseNumericCell(s) === null;
    }).length;
    const score = nonEmptyCount * 2 + textCells;
    if (score > bestScore) {
      bestScore = score;
      bestRowIndex = r;
    }
  }

  return bestRowIndex + 1;
}

/**
 * Generates the next Serasa Salam invoice number in format INV/SS/UND/DDMMYY/XX
 * based on today's date and the highest trailing sequence number in Tracker Closing.
 */
export function generateNextInvoiceCode(existingInvoices: string[]): string {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yy = String(now.getFullYear()).slice(-2);

  let maxSeq = 0;
  for (const inv of existingInvoices) {
    const match = inv.trim().match(/\/(\d+)$/);
    if (match && match[1]) {
      const n = parseInt(match[1], 10);
      if (!Number.isNaN(n) && n > maxSeq) {
        maxSeq = n;
      }
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(2, '0');
  return `INV/SS/UND/${dd}${mm}${yy}/${nextSeq}`;
}

function inferColumnSchema(
  index: number,
  headerName: string,
  sheetTitle: string,
  dataRows: { rowNumber1Based: number; values: string[] }[]
): ColumnSchema {
  const letter = columnIndexToLetter(index);
  const lower = headerName.toLowerCase();
  const tabRule = SERASA_TAB_RULES[sheetTitle];
  const isFormulaColumn = tabRule ? tabRule.formulaColIndices.includes(index) : false;

  const nonEmptyValues = dataRows
    .map((r) => (r.values[index] || '').trim())
    .filter((v) => v.length > 0);

  const uniqueSet = new Set<string>();
  // Pre-populate with preset options from SERASA_TAB_RULES if defined for this column
  const presets = tabRule?.presetOptions?.[headerName] || [];
  for (const p of presets) {
    uniqueSet.add(p);
  }
  for (const v of nonEmptyValues) {
    if (v.length <= 60) uniqueSet.add(v);
  }
  const uniqueValues = Array.from(uniqueSet).slice(0, 30);

  // Check if No. Invoice column
  if (/no\.?\s*invoice/i.test(headerName.trim())) {
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'invoice',
      isFormulaColumn,
      uniqueValues: Array.from(new Set(nonEmptyValues)).slice(-8).reverse(),
      nextInvoiceCode: generateNextInvoiceCode(nonEmptyValues),
    };
  }

  if (/^(no\.?|nomor|urut)$/i.test(headerName.trim())) {
    const nums = nonEmptyValues
      .map((v) => parseInt(v, 10))
      .filter((n) => !Number.isNaN(n) && n > 0);
    const maxNum = nums.length > 0 ? Math.max(...nums) : dataRows.length;
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'autonumber',
      isFormulaColumn,
      uniqueValues,
      nextAutoNumber: maxNum + 1,
    };
  }

  if (/(tanggal|tgl|date|waktu|deadline)/i.test(lower)) {
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'date',
      isFormulaColumn,
      uniqueValues,
    };
  }

  if (
    /(harga|subtotal|nominal|total|jumlah\s*rp|biaya|pemasukan|pengeluaran|saldo|kas|dp|uang\s*muka|bayar|sisa|tagihan|piutang|omzet|profit|laba|modal|diskon|ongkir|komisi)/i.test(
      lower
    ) &&
    !/(status|metode|tipe|via|bank|bukti|tanggal|tgl|catatan|%)/i.test(lower) &&
    !(sheetTitle === 'PO Ganci' && headerName === 'Bayar')
  ) {
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'currency',
      isFormulaColumn,
      uniqueValues,
    };
  }

  if (/(qty|kuantitas|jumlah\s*baris|jml|pcs)/i.test(lower)) {
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'number',
      isFormulaColumn,
      uniqueValues,
    };
  }

  if (
    presets.length > 0 ||
    /(status|kategori|jenis|paket|tipe|tema|warna|channel|metode|tier)/i.test(lower) ||
    (nonEmptyValues.length >= 4 && uniqueValues.length >= 1 && uniqueValues.length <= 12)
  ) {
    return {
      index,
      letter,
      name: headerName,
      inferredType: 'select',
      isFormulaColumn,
      uniqueValues,
    };
  }

  return {
    index,
    letter,
    name: headerName,
    inferredType: 'text',
    isFormulaColumn,
    uniqueValues,
  };
}

/**
 * Reads all values from a specific sheet tab and normalizes headers, column schemas, and active rows.
 */
export async function getSheetValues(
  spreadsheetId: string,
  sheetTitle: string,
  customHeaderRow1Based?: number,
  scriptUrl?: string,
  sheetId?: number
): Promise<SheetDataResult> {
  let rawValues: string[][] = [];

  if (scriptUrl && scriptUrl.trim()) {
    const data = await callGasProxy(scriptUrl, {
      action: 'getSheetValues',
      spreadsheetId,
      sheetTitle,
    });
    rawValues = data.values || [];
  } else {
    const res = await fetch(
      `/api/public-sheet/values?spreadsheetId=${encodeURIComponent(
        spreadsheetId
      )}&sheetTitle=${encodeURIComponent(sheetTitle)}${
        sheetId !== undefined ? `&sheetId=${sheetId}` : ''
      }`
    );
    const data = await res.json();
    if (!res.ok) {
      throw new SheetsApiError(
        data.error || 'Gagal membaca isi tab spreadsheet.',
        res.status
      );
    }
    rawValues = data.values || [];
  }

  if (rawValues.length === 0) {
    return {
      sheetTitle,
      headerRow1Based: 1,
      nextInsertRow1Based: 2,
      headers: [],
      columns: [],
      rows: [],
      rawValues: [],
    };
  }

  const tabRule = SERASA_TAB_RULES[sheetTitle];
  const headerRow1Based =
    customHeaderRow1Based && customHeaderRow1Based >= 1
      ? Math.min(customHeaderRow1Based, rawValues.length)
      : detectBestHeaderRow(rawValues, sheetTitle);

  const headerRowIndex0 = headerRow1Based - 1;
  const detectedMaxCols = rawValues.reduce((max, row) => Math.max(max, row.length), 0);
  const maxCols = tabRule?.maxColumns
    ? Math.min(tabRule.maxColumns, Math.max(tabRule.maxColumns, detectedMaxCols))
    : detectedMaxCols;

  const rawHeaderRow = rawValues[headerRowIndex0] || [];
  const headers = Array.from({ length: maxCols }, (_, colIdx) => {
    const cell = (rawHeaderRow[colIdx] || '').trim();
    return cell || `Kolom ${columnIndexToLetter(colIdx)}`;
  });

  const dataStartIndex = headerRowIndex0 + 1;
  const rows = rawValues
    .slice(dataStartIndex)
    .map((rowValues, idx) => {
      const normalizedValues = Array.from({ length: maxCols }, (_, colIdx) =>
        rowValues[colIdx] !== undefined && rowValues[colIdx] !== null
          ? String(rowValues[colIdx]).trim()
          : ''
      );
      return {
        rowNumber1Based: dataStartIndex + idx + 1,
        values: normalizedValues,
      };
    })
    .filter((row) => {
      // If tab has requiredInputColIndices (e.g. Tracker Closing has pre-filled Rp0 formulas in K, N, P),
      // only include rows where at least one required input column is non-empty!
      if (tabRule && tabRule.requiredInputColIndices.length > 0) {
        return tabRule.requiredInputColIndices.some(
          (colIdx) => (row.values[colIdx] || '').trim() !== ''
        );
      }
      return row.values.some((cell) => cell.trim() !== '');
    });

  // Determine the exact next row number where a new entry should be inserted
  // (e.g. in Tracker Closing, if last filled row is #43, next insert row is #44, NOT #1002!)
  const lastFilledRowNum =
    rows.length > 0 ? rows[rows.length - 1].rowNumber1Based : headerRow1Based;
  const nextInsertRow1Based = lastFilledRowNum + 1;

  const columns = headers.map((h, idx) => inferColumnSchema(idx, h, sheetTitle, rows));

  return {
    sheetTitle,
    headerRow1Based,
    nextInsertRow1Based,
    headers,
    columns,
    rows,
    rawValues,
  };
}

/**
 * Writes a new row at `nextInsertRow1Based`, preserving any blue formula columns (`formulaColIndices`).
 */
export async function appendSheetRow(
  spreadsheetId: string,
  sheetTitle: string,
  values: string[],
  nextInsertRow1Based: number,
  scriptUrl?: string
): Promise<void> {
  const tabRule = SERASA_TAB_RULES[sheetTitle];
  const formulaColIndices = tabRule ? tabRule.formulaColIndices : [];

  if (scriptUrl && scriptUrl.trim()) {
    await callGasProxy(scriptUrl, {
      action: 'writeRow',
      spreadsheetId,
      sheetTitle,
      rowNumber1Based: nextInsertRow1Based,
      values,
      formulaColIndices,
    });
    return;
  }

  // Fallback to OAuth if token exists
  const token = await getAccessToken();
  if (!token) {
    throw new SheetsApiError(
      'Agar input dari aplikasi langsung tertulis ke Google Sheet Serasa Salam tanpa terblokir Error 403, silakan pasang URL Web App Google Apps Script pada tombol "Aktifkan Simpan 2 Arah (Apps Script)".',
      401
    );
  }

  // Write only non-formula columns using values:batchUpdate so formulas in K, N, P are preserved
  const dataBatch = values
    .map((val, colIdx) => {
      if (formulaColIndices.includes(colIdx)) return null;
      const colLetter = columnIndexToLetter(colIdx);
      return {
        range: `${sheetTitle}!${colLetter}${nextInsertRow1Based}`,
        values: [[val]],
      };
    })
    .filter(Boolean);

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataBatch,
      }),
    }
  );
}

/**
 * Updates an existing row in the specified sheet tab at `rowNumber1Based`, preserving formula columns.
 */
export async function updateSheetRow(
  spreadsheetId: string,
  sheetTitle: string,
  rowNumber1Based: number,
  values: string[],
  scriptUrl?: string
): Promise<void> {
  const tabRule = SERASA_TAB_RULES[sheetTitle];
  const formulaColIndices = tabRule ? tabRule.formulaColIndices : [];

  if (scriptUrl && scriptUrl.trim()) {
    await callGasProxy(scriptUrl, {
      action: 'writeRow',
      spreadsheetId,
      sheetTitle,
      rowNumber1Based,
      values,
      formulaColIndices,
    });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    throw new SheetsApiError(
      'Untuk menyimpan perubahan ke Google Sheet tanpa Login OAuth, silakan pasang URL Web App Google Apps Script pada menu "Aktifkan Simpan 2 Arah".',
      401
    );
  }

  const dataBatch = values
    .map((val, colIdx) => {
      if (formulaColIndices.includes(colIdx)) return null;
      const colLetter = columnIndexToLetter(colIdx);
      return {
        range: `${sheetTitle}!${colLetter}${rowNumber1Based}`,
        values: [[val]],
      };
    })
    .filter(Boolean);

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: dataBatch,
      }),
    }
  );
}

/**
 * Deletes or clears a single row by 1-based row number.
 */
export async function deleteSheetRow(
  spreadsheetId: string,
  sheetId: number,
  rowNumber1Based: number,
  sheetTitle?: string,
  scriptUrl?: string
): Promise<void> {
  const tabRule = sheetTitle ? SERASA_TAB_RULES[sheetTitle] : undefined;
  const formulaColIndices = tabRule ? tabRule.formulaColIndices : [];

  if (scriptUrl && scriptUrl.trim()) {
    await callGasProxy(scriptUrl, {
      action: 'deleteRow',
      spreadsheetId,
      sheetTitle,
      rowNumber1Based,
      formulaColIndices,
      maxColumns: tabRule?.maxColumns,
    });
    return;
  }

  const token = await getAccessToken();
  if (!token) {
    throw new SheetsApiError(
      'Untuk menghapus baris tanpa Login OAuth, silakan pasang URL Web App Google Apps Script.',
      401
    );
  }

  const startIndex = rowNumber1Based - 1;
  const endIndex = rowNumber1Based;

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId,
                dimension: 'ROWS',
                startIndex,
                endIndex,
              },
            },
          },
        ],
      }),
    }
  );
}

export async function createSheetTab(
  spreadsheetId: string,
  tabTitle: string,
  initialHeaders: string[] = [],
  scriptUrl?: string
): Promise<void> {
  if (scriptUrl && scriptUrl.trim()) {
    await callGasProxy(scriptUrl, {
      action: 'createSheetTab',
      spreadsheetId,
      tabTitle,
      initialHeaders,
    });
    return;
  }

  await fetchWithAuth(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}:batchUpdate`,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            addSheet: {
              properties: {
                title: tabTitle,
              },
            },
          },
        ],
      }),
    }
  );
}
