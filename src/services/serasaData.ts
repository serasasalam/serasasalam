import {
  DEFAULT_SERASA_SALAM_SPREADSHEET_ID,
  getSheetValues,
  parseNumericCell,
  SheetDataResult,
} from './sheetsApi';

export interface ClosingOrderItem {
  rowNumber1Based: number;
  invoiceNo: string;
  tanggalLead: string;
  namaKlien: string;
  noWa: string;
  jenisAcara: string;
  tanggalAcara: string;
  channel: string;
  paket: string;
  qty: number;
  hargaPcs: number;
  subtotal: number;
  diskon: number;
  ongkir: number;
  totalTagihan: number;
  bayar: number;
  sisa: number;
  metodeBayar: string;
  status: string;
  deadline: string;
  catatan: string;
  kodeMitra: string;
  rawValues: string[];
}

export interface PaketHargaItem {
  paket: string;
  target: string;
  fasilitas: string;
  hargaMulai: number;
  minimal: string;
}

export interface SerasaWorkspaceBundle {
  closingSheet: SheetDataResult;
  closingOrders: ClosingOrderItem[];
}

export function parseClosingOrders(sheet: SheetDataResult): ClosingOrderItem[] {
  return sheet.rows.map((r) => {
    const v = r.values;
    const qty = parseNumericCell(v[8] || '') || 0;
    const hargaPcs = parseNumericCell(v[9] || '') || 0;
    const rawSubtotal = parseNumericCell(v[10] || '');
    const diskon = parseNumericCell(v[11] || '') || 0;
    const ongkir = parseNumericCell(v[12] || '') || 0;
    const subtotal = rawSubtotal !== null ? rawSubtotal : qty * hargaPcs;

    const rawTotal = parseNumericCell(v[13] || '');
    const totalTagihan =
      rawTotal !== null ? rawTotal : Math.max(0, subtotal - diskon + ongkir);

    const bayar = parseNumericCell(v[14] || '') || 0;
    const rawSisa = parseNumericCell(v[15] || '');
    const sisa = rawSisa !== null ? rawSisa : Math.max(0, totalTagihan - bayar);

    return {
      rowNumber1Based: r.rowNumber1Based,
      invoiceNo: (v[0] || '').trim(),
      tanggalLead: (v[1] || '').trim(),
      namaKlien: (v[2] || '').trim(),
      noWa: (v[3] || '').trim(),
      jenisAcara: (v[4] || 'Wedding').trim(),
      tanggalAcara: (v[5] || '').trim(),
      channel: (v[6] || 'WhatsApp').trim(),
      paket: (v[7] || '').trim(),
      qty,
      hargaPcs,
      subtotal,
      diskon,
      ongkir,
      totalTagihan,
      bayar,
      sisa,
      metodeBayar: (v[16] || '').trim(),
      status: (v[17] || 'Menunggu DP').trim(),
      deadline: (v[18] || '').trim(),
      catatan: (v[19] || '').trim(),
      kodeMitra: (v[20] || '').trim(),
      rawValues: v,
    };
  });
}

export const SERASA_CATALOG_PACKAGES: PaketHargaItem[] = [
  {
    paket: 'Undangan Cetak Basic',
    target: 'Acara sederhana & hemat',
    fasilitas:
      'Desain Undangan Blangko, Kertas standar 150gsm, Revisi 2x, Bonus Plastik & Label Nama',
    hargaMulai: 1000,
    minimal: '100 pcs',
  },
  {
    paket: 'Undangan Cetak Premium',
    target: 'Paling laku (Best Seller)',
    fasilitas:
      'Desain eksklusif, Kertas tebal AP210/Jasmine, Cetak 2 sisi, Revisi fleksibel, Bonus Softfile, Plastik & Label',
    hargaMulai: 2300,
    minimal: '100 pcs',
  },
  {
    paket: 'Eksklusif',
    target: 'Acara formal & mewah',
    fasilitas:
      'Desain custom penuh, Kertas premium + Hardcover/Amplop, Finishing khusus (Foil/Emboss), Bonus Undangan Digital',
    hargaMulai: 8500,
    minimal: '100 pcs',
  },
  {
    paket: 'Undangan Digital',
    target: 'Praktis & sebar via WhatsApp',
    fasilitas:
      'Website undangan responsif, Galeri foto, Navigasi Maps, RSVP & Ucapan, Musik latar, Masa aktif panjang',
    hargaMulai: 70000,
    minimal: '1 link',
  },
  {
    paket: 'Kartu Souvenir',
    target: 'Pelengkap souvenir pernikahan',
    fasilitas: 'Cetak full color custom nama pengantin & tanggal acara',
    hargaMulai: 10000,
    minimal: '1 pak',
  },
];

/**
 * Loads only Tracker Closing for fast, focused sales & invoice management.
 */
export async function fetchSerasaWorkspaceBundle(
  spreadsheetId: string = DEFAULT_SERASA_SALAM_SPREADSHEET_ID,
  scriptUrl?: string
): Promise<SerasaWorkspaceBundle> {
  const closingSheet = await getSheetValues(
    spreadsheetId,
    'Tracker Closing',
    1,
    scriptUrl,
    1373780580
  );

  return {
    closingSheet,
    closingOrders: parseClosingOrders(closingSheet),
  };
}
