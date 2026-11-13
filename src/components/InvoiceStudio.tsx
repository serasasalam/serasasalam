import React, { useMemo, useState } from 'react';
import { jsPDF } from 'jspdf';
import { ClosingOrderItem } from '../services/serasaData';
import { SERASA_SALAM_LOGO_DATA_URL } from '../assets/serasaLogoDataUrl';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  FileText,
  MessageCircle,
  Printer,
  Search,
} from 'lucide-react';

interface InvoiceStudioProps {
  orders: ClosingOrderItem[];
  selectedInvoiceNo: string;
  onSelectInvoiceNo: (inv: string) => void;
  onQuickMarkPaidAndDone?: (item: ClosingOrderItem) => void;
}

/**
 * Formats currency exactly like the Serasa Salam PDF Invoice:
 * "Rp805.000", "Rp2.300", "Rp0" (no space between Rp and digits)
 */
export function formatRpInvoice(num: number): string {
  if (!Number.isFinite(num)) return 'Rp0';
  const abs = Math.round(Math.abs(num));
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
  }).format(abs);
  return num < 0 ? `-Rp${formatted}` : `Rp${formatted}`;
}

const INDONESIAN_DAYS = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
];

const INDONESIAN_FULL_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const SHORT_MONTH_MAP: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  may: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agu: 7,
  ags: 7,
  aug: 7,
  agustus: 7,
  sep: 8,
  sept: 8,
  september: 8,
  okt: 9,
  oct: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  des: 11,
  dec: 11,
  desember: 11,
};

/**
 * Converts a sheet date string (e.g. "12 Nov 2026", "21 Nov 2026", "2026-11-12", "12/11/2026")
 * into the exact format used in the Serasa Salam Invoice PDF:
 * "Kamis, 12 November 2026"
 */
export function formatIndonesianFullDate(raw: string): string {
  if (!raw || !raw.trim()) return '-';
  const s = raw.trim();

  // If already contains day name and comma (e.g. "Kamis, 12 November 2026"), return as-is
  if (/^(minggu|senin|selasa|rabu|kamis|jumat|sabtu)\s*,/i.test(s)) {
    return s;
  }

  let day = 0;
  let monthIdx = -1;
  let year = 0;

  // 1. Match "12 Nov 2026" or "12 November 2026"
  const textMatch = s.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
  if (textMatch) {
    day = parseInt(textMatch[1], 10);
    const mKey = textMatch[2].toLowerCase();
    if (mKey in SHORT_MONTH_MAP) {
      monthIdx = SHORT_MONTH_MAP[mKey];
    }
    year = parseInt(textMatch[3], 10);
  }

  // 2. Match "YYYY-MM-DD"
  if (monthIdx < 0) {
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      year = parseInt(isoMatch[1], 10);
      monthIdx = parseInt(isoMatch[2], 10) - 1;
      day = parseInt(isoMatch[3], 10);
    }
  }

  // 3. Match "DD/MM/YYYY"
  if (monthIdx < 0) {
    const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (slashMatch) {
      day = parseInt(slashMatch[1], 10);
      monthIdx = parseInt(slashMatch[2], 10) - 1;
      year = parseInt(slashMatch[3], 10);
      if (year < 100) year += 2000;
    }
  }

  if (day > 0 && monthIdx >= 0 && monthIdx < 12 && year > 1900) {
    const dt = new Date(year, monthIdx, day);
    if (!Number.isNaN(dt.getTime())) {
      const dayName = INDONESIAN_DAYS[dt.getDay()];
      const monthName = INDONESIAN_FULL_MONTHS[monthIdx];
      return `${dayName}, ${day} ${monthName} ${year}`;
    }
  }

  return s;
}

/**
 * Builds the exact PDF filename requested by the user:
 * "[Nama Pemesan] - [Tanggal Order] - [Nomor Invoice].pdf"
 */
export function buildInvoicePdfFilename(
  namaKlien: string,
  tanggalLead: string,
  invoiceNo: string
): string {
  const cleanPart = (str: string) =>
    str
      .trim()
      .replace(/[\/\\?%*:|"<>]/g, '-') // Replace "/" in INV/SS/UND/... with "-" so OS saves cleanly
      .replace(/\s+/g, ' ');

  const namePart = cleanPart(namaKlien || 'Pelanggan');
  const datePart = cleanPart(tanggalLead || 'Tanpa Tanggal');
  const invPart = cleanPart(invoiceNo || 'INV');

  return `${namePart} - ${datePart} - ${invPart}.pdf`;
}

export const InvoiceStudio: React.FC<InvoiceStudioProps> = ({
  orders,
  selectedInvoiceNo,
  onSelectInvoiceNo,
  onQuickMarkPaidAndDone,
}) => {
  const [searchInv, setSearchInv] = useState<string>('');
  const [copiedWa, setCopiedWa] = useState<boolean>(false);

  // Group orders by invoiceNo (newest first)
  const invoiceGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        invoiceNo: string;
        namaKlien: string;
        noWa: string;
        tanggalLead: string;
        jenisAcara: string;
        tanggalAcara: string;
        deadline: string;
        status: string;
        metodeBayar: string;
        catatanGabungan: string;
        items: ClosingOrderItem[];
        subtotal: number;
        diskon: number;
        ongkir: number;
        totalTagihan: number;
        bayar: number;
        sisa: number;
      }
    >();

    for (const o of orders) {
      const key = o.invoiceNo || `ROW-${o.rowNumber1Based}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, {
          invoiceNo: key,
          namaKlien: o.namaKlien,
          noWa: o.noWa,
          tanggalLead: o.tanggalLead,
          jenisAcara: o.jenisAcara,
          tanggalAcara: o.tanggalAcara,
          deadline: o.deadline,
          status: o.status,
          metodeBayar: o.metodeBayar,
          catatanGabungan: o.catatan || '',
          items: [o],
          subtotal: o.subtotal,
          diskon: o.diskon,
          ongkir: o.ongkir,
          totalTagihan: o.totalTagihan,
          bayar: o.bayar,
          sisa: o.sisa,
        });
      } else {
        existing.items.push(o);
        if (o.catatan && !existing.catatanGabungan.includes(o.catatan)) {
          existing.catatanGabungan = existing.catatanGabungan
            ? `${existing.catatanGabungan}, ${o.catatan}`
            : o.catatan;
        }
        existing.subtotal += o.subtotal;
        existing.diskon += o.diskon;
        existing.ongkir += o.ongkir;
        existing.totalTagihan += o.totalTagihan;
        existing.bayar += o.bayar;
        existing.sisa += o.sisa;
      }
    }

    return Array.from(map.values()).reverse();
  }, [orders]);

  const filteredGroups = useMemo(() => {
    if (!searchInv.trim()) return invoiceGroups;
    const q = searchInv.toLowerCase().trim();
    return invoiceGroups.filter(
      (g) =>
        g.invoiceNo.toLowerCase().includes(q) ||
        g.namaKlien.toLowerCase().includes(q) ||
        g.items.some((i) => i.paket.toLowerCase().includes(q))
    );
  }, [invoiceGroups, searchInv]);

  const activeInvoice = useMemo(() => {
    if (selectedInvoiceNo) {
      const found = invoiceGroups.find((g) => g.invoiceNo === selectedInvoiceNo);
      if (found) return found;
    }
    return invoiceGroups[0] || null;
  }, [invoiceGroups, selectedInvoiceNo]);

  const pdfFilename = useMemo(() => {
    if (!activeInvoice) return 'Invoice.pdf';
    return buildInvoicePdfFilename(
      activeInvoice.namaKlien,
      activeInvoice.tanggalLead,
      activeInvoice.invoiceNo
    );
  }, [activeInvoice]);

  // Prepare 5 fixed table slots exactly like the Google Sheets INVOICE template
  const fiveTableSlots = useMemo(() => {
    const slots: (ClosingOrderItem | null)[] = [null, null, null, null, null];
    if (activeInvoice) {
      activeInvoice.items.slice(0, 5).forEach((item, idx) => {
        slots[idx] = item;
      });
    }
    return slots;
  }, [activeInvoice]);

  /**
   * Generates a 1:1 replica of the Serasa Salam A4 PDF Invoice
   * (with the extracted Gold Lotus logo, 5 alternating gray/white item rows,
   * Sub Total / Disc / Total / Bayar / Sisa Bayar blocks, BCA account info, and Catatan box)
   * and saves it as: "[Nama Pemesan] - [Tanggal Order] - [Nomor Invoice].pdf"
   */
  const handleDownloadPdf = () => {
    if (!activeInvoice) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Coordinate mapping matching the original PDF:
    // Left margin = 28mm, Right margin = 28mm -> Content width = 154mm (x: 28 .. 182)
    const leftX = 27.5;
    const rightX = 182.5;
    const contentW = rightX - leftX; // 155mm

    // 1. Top Header: "INVOICE" on left, Serasa Salam Gold Lotus Logo on right
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(26);
    doc.setTextColor(0, 0, 0);
    doc.text('INVOICE', leftX + 1, 30);

    // Add extracted Serasa Salam Undangan Lembang Logo at top-right
    // Original aspect ratio: 907 x 179 (~5.067 : 1)
    const logoW = 58;
    const logoH = 11.45;
    doc.addImage(
      SERASA_SALAM_LOGO_DATA_URL,
      'PNG',
      rightX - logoW,
      20.5,
      logoW,
      logoH
    );

    // 2. Metadata Row 1: No. Invoice (Left) & Tgl. Order: (Right)
    const metaY1 = 44.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('No. Invoice', leftX + 1, metaY1);
    doc.text('Tgl. Order:', rightX - 1, metaY1, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(activeInvoice.invoiceNo || '-', leftX + 1, metaY1 + 5);
    doc.text(
      formatIndonesianFullDate(activeInvoice.tanggalLead),
      rightX - 1,
      metaY1 + 5,
      { align: 'right' }
    );

    // 3. Metadata Row 2: Yth. (Left) & Deadline: (Right)
    const metaY2 = 59.5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Yth.', leftX + 1, metaY2);
    doc.text('Deadline:', rightX - 1, metaY2, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(activeInvoice.namaKlien || '-', leftX + 1, metaY2 + 5);
    doc.text(
      formatIndonesianFullDate(
        activeInvoice.deadline || activeInvoice.tanggalAcara
      ),
      rightX - 1,
      metaY2 + 5,
      { align: 'right' }
    );

    // 4. Main 5-Row Order Table
    // Column widths matching PDF ratios:
    // Col 1 (Nama Order): 48.5mm | Col 2 (Harga): 28mm | Col 3 (Qty): 23.2mm | Col 4 (Jumlah): 55.3mm = 155mm
    const tableTopY = 71;
    const headerH = 7.2;
    const rowH = 17.2; // 5 rows * 17.2mm = 86mm
    const col1W = 48.5;
    const col2W = 28.0;
    const col3W = 23.2;
    const col4W = contentW - col1W - col2W - col3W; // 55.3mm

    const col1X = leftX;
    const col2X = col1X + col1W;
    const col3X = col2X + col2W;
    const col4X = col3X + col3W;

    // Header background (#D9D9D9)
    doc.setFillColor(217, 217, 217);
    doc.rect(leftX, tableTopY, contentW, headerH, 'F');

    // Header text (Centered Bold)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text('Nama Order', col1X + col1W / 2, tableTopY + 5, {
      align: 'center',
    });
    doc.text('Harga', col2X + col2W / 2, tableTopY + 5, { align: 'center' });
    doc.text('Qty', col3X + col3W / 2, tableTopY + 5, { align: 'center' });
    doc.text('Jumlah', col4X + col4W / 2, tableTopY + 5, { align: 'center' });

    // Darker gray bottom border under header (#8E8E8E)
    doc.setDrawColor(142, 142, 142);
    doc.setLineWidth(0.35);
    doc.line(leftX, tableTopY + headerH, rightX, tableTopY + headerH);

    // 5 Fixed Item Rows (Alternating White #FFFFFF and Light Gray #F3F3F3)
    const rowsStartY = tableTopY + headerH;
    fiveTableSlots.forEach((slotItem, idx) => {
      const rY = rowsStartY + idx * rowH;
      if (idx % 2 === 1) {
        doc.setFillColor(243, 243, 243); // #F3F3F3
        doc.rect(leftX, rY, contentW, rowH, 'F');
      } else {
        doc.setFillColor(255, 255, 255);
        doc.rect(leftX, rY, contentW, rowH, 'F');
      }

      if (slotItem) {
        const textY = rY + rowH / 2 + 1.2;
        // Nama Order (Bold Left)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(slotItem.paket || '-', col1X + 1, textY);

        // Harga (Regular Center)
        doc.setFont('helvetica', 'normal');
        doc.text(
          formatRpInvoice(slotItem.hargaPcs),
          col2X + col2W / 2,
          textY,
          { align: 'center' }
        );

        // Qty (Regular Center)
        doc.text(String(slotItem.qty), col3X + col3W / 2, textY, {
          align: 'center',
        });

        // Jumlah (Bold Center)
        doc.setFont('helvetica', 'bold');
        doc.text(
          formatRpInvoice(slotItem.subtotal),
          col4X + col4W / 2,
          textY,
          { align: 'center' }
        );
      }
    });

    // Outer table border (#D9D9D9)
    const tableTotalH = headerH + rowH * 5;
    doc.setDrawColor(217, 217, 217);
    doc.setLineWidth(0.3);
    doc.rect(leftX, tableTopY, contentW, tableTotalH, 'S');

    // 5. Bottom Section (Below Table)
    const bottomStartY = tableTopY + tableTotalH + 5; // ~169.2mm
    const summaryLeftX = col3X; // Aligns right column with Col 3 + Col 4 (x = 104 .. 182.5, width = 78.5mm)
    const summaryW = rightX - summaryLeftX;
    const sumRowH = 5.4;

    // Left Side Note 1: *Waktu produksi sesuai deadline tertera dan ACC desain
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.text(
      '*Waktu produksi sesuai deadline tertera',
      leftX + 1,
      bottomStartY + 3.8
    );
    doc.text('dan ACC desain', leftX + 1, bottomStartY + 8.8);

    // Right Side Summary Rows:
    // Row 1: Sub Total (Gray #EFEFEF, Bold)
    let curSumY = bottomStartY;
    doc.setFillColor(239, 239, 239);
    doc.rect(summaryLeftX, curSumY, summaryW, sumRowH, 'F');
    doc.setDrawColor(217, 217, 217);
    doc.line(summaryLeftX, curSumY + sumRowH, rightX, curSumY + sumRowH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Sub Total', summaryLeftX + 1, curSumY + 3.9);
    doc.text(
      formatRpInvoice(activeInvoice.subtotal),
      rightX - 1,
      curSumY + 3.9,
      { align: 'right' }
    );

    // Row 2: Disc. (White, Regular label, Bold value)
    curSumY += sumRowH;
    doc.setFont('helvetica', 'normal');
    doc.text('Disc.', summaryLeftX + 1, curSumY + 3.9);
    doc.setFont('helvetica', 'bold');
    doc.text(
      formatRpInvoice(activeInvoice.diskon),
      rightX - 1,
      curSumY + 3.9,
      { align: 'right' }
    );

    // Blank spacer row (height ~4.5mm)
    curSumY += sumRowH + 4.5;

    // Row 3: Total (Gray #EFEFEF, Bold)
    doc.setFillColor(239, 239, 239);
    doc.rect(summaryLeftX, curSumY, summaryW, sumRowH, 'F');
    doc.setDrawColor(217, 217, 217);
    doc.line(summaryLeftX, curSumY + sumRowH, rightX, curSumY + sumRowH);
    doc.setFont('helvetica', 'bold');
    doc.text('Total', summaryLeftX + 1, curSumY + 3.9);
    doc.text(
      formatRpInvoice(activeInvoice.totalTagihan),
      rightX - 1,
      curSumY + 3.9,
      { align: 'right' }
    );

    // Row 4: Bayar (White, Regular label & value, bottom border)
    curSumY += sumRowH;
    doc.setDrawColor(217, 217, 217);
    doc.line(summaryLeftX, curSumY + sumRowH, rightX, curSumY + sumRowH);
    doc.setFont('helvetica', 'normal');
    doc.text('Bayar', summaryLeftX + 1, curSumY + 3.9);
    doc.text(formatRpInvoice(activeInvoice.bayar), rightX - 1, curSumY + 3.9, {
      align: 'right',
    });

    // Row 5: Sisa Bayar (Gray #EFEFEF, Bold)
    curSumY += sumRowH;
    doc.setFillColor(239, 239, 239);
    doc.rect(summaryLeftX, curSumY, summaryW, sumRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.text('Sisa Bayar', summaryLeftX + 1, curSumY + 3.9);
    doc.text(formatRpInvoice(activeInvoice.sisa), rightX - 1, curSumY + 3.9, {
      align: 'right',
    });

    // 6. Lower Payment Info (Left) & Catatan Box (Right)
    const lowerBlockY = curSumY + sumRowH + 9.5;

    // Left: Pembayaran ke Rekening BCA
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('Pembayaran ke Rekening BCA', leftX + 1, lowerBlockY);

    doc.setFont('helvetica', 'bold');
    doc.text('137 026 1136 a.n Rinaldy Harisma H', leftX + 1, lowerBlockY + 5);

    doc.setFont('helvetica', 'normal');
    doc.text(
      'Diproses setelah ada pembayaran LUNAS',
      leftX + 1,
      lowerBlockY + 10
    );
    doc.text('atau minimal DP 50%', leftX + 1, lowerBlockY + 15);

    // Thank you (Bold Italic)
    doc.setFont('helvetica', 'bolditalic');
    doc.text('Terima Kasih', leftX + 1, lowerBlockY + 25);
    doc.text('Atas Pesanan Anda', leftX + 1, lowerBlockY + 30);

    // Right: Catatan (Italic header + bordered box with Bold Italic note)
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.text('Catatan', summaryLeftX + 1, lowerBlockY);

    const noteBoxY = lowerBlockY + 1.5;
    const noteBoxH = 29;
    doc.setDrawColor(217, 217, 217);
    doc.setLineWidth(0.3);
    doc.rect(summaryLeftX, noteBoxY, summaryW, noteBoxH, 'S');

    if (activeInvoice.catatanGabungan) {
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(10);
      const wrappedNote = doc.splitTextToSize(
        activeInvoice.catatanGabungan,
        summaryW - 3
      );
      doc.text(wrappedNote, summaryLeftX + 1, noteBoxY + 4.2);
    }

    doc.save(pdfFilename);
  };

  const handleWindowPrint = () => {
    const prevTitle = document.title;
    document.title = pdfFilename.replace(/\.pdf$/i, '');
    window.print();
    setTimeout(() => {
      document.title = prevTitle;
    }, 500);
  };

  const buildWhatsAppMessage = () => {
    if (!activeInvoice) return '';
    const itemLines = activeInvoice.items
      .map(
        (it, i) =>
          `${i + 1}. ${it.paket} (${it.qty} pcs x ${formatRpInvoice(
            it.hargaPcs
          )}) = ${formatRpInvoice(it.subtotal)}`
      )
      .join('\n');

    return [
      `*INVOICE — SERASA SALAM UNDANGAN LEMBANG*`,
      `No. Invoice: *${activeInvoice.invoiceNo}*`,
      `Tgl. Order: ${formatIndonesianFullDate(activeInvoice.tanggalLead)}`,
      `Yth: *${activeInvoice.namaKlien}*`,
      `Deadline: ${formatIndonesianFullDate(
        activeInvoice.deadline || activeInvoice.tanggalAcara
      )}`,
      ``,
      `*RINCIAN ORDER:*`,
      itemLines,
      ``,
      `Sub Total: ${formatRpInvoice(activeInvoice.subtotal)}`,
      `Disc.: ${formatRpInvoice(activeInvoice.diskon)}`,
      `*Total: ${formatRpInvoice(activeInvoice.totalTagihan)}*`,
      `Bayar: ${formatRpInvoice(activeInvoice.bayar)}`,
      `*Sisa Bayar: ${formatRpInvoice(activeInvoice.sisa)}*`,
      activeInvoice.catatanGabungan
        ? `\n_Catatan: ${activeInvoice.catatanGabungan}_`
        : null,
      ``,
      `Pembayaran ke Rekening BCA`,
      `*137 026 1136 a.n Rinaldy Harisma H*`,
      `Diproses setelah ada pembayaran LUNAS atau minimal DP 50%`,
      ``,
      `_Terima Kasih Atas Pesanan Anda_`,
    ]
      .filter((line) => line !== null)
      .join('\n');
  };

  const handleCopyWa = async () => {
    const text = buildWhatsAppMessage();
    try {
      await navigator.clipboard.writeText(text);
      setCopiedWa(true);
      setTimeout(() => setCopiedWa(false), 2500);
    } catch {
      // ignore
    }
  };

  const cleanWaPhone = (raw: string): string => {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits || digits === '0') return '';
    if (digits.startsWith('0')) return `62${digits.slice(1)}`;
    if (digits.startsWith('8')) return `62${digits}`;
    return digits;
  };

  if (!activeInvoice) {
    return (
      <div className="bg-white border border-slate-200 rounded-3xl p-8 text-center">
        <p className="text-sm font-semibold text-slate-700">Belum ada data Invoice.</p>
      </div>
    );
  }

  const waDigits = cleanWaPhone(activeInvoice.noWa);
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(buildWhatsAppMessage())}`
    : '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-7.5rem)] lg:overflow-hidden print:block print:h-auto print:overflow-visible">
      {/* Left 4 Cols: Independently Scrollable Invoice Selector List */}
      <div className="lg:col-span-4 bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs flex flex-col max-h-[420px] lg:max-h-none lg:h-full print:hidden">
        <div className="shrink-0 p-4 border-b border-slate-200 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900">
              Pilih Faktur / Invoice ({invoiceGroups.length})
            </h3>
            <span className="text-[11px] text-slate-400">Dari Tracker Closing</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInv}
              onChange={(e) => setSearchInv(e.target.value)}
              placeholder="Cari Nama Pemesan atau No. Invoice..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredGroups.map((grp) => {
            const isSelected = grp.invoiceNo === activeInvoice.invoiceNo;
            const isPaid = grp.sisa <= 0;
            return (
              <button
                key={grp.invoiceNo}
                type="button"
                onClick={() => onSelectInvoiceNo(grp.invoiceNo)}
                className={`w-full p-4 text-left transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  isSelected ? 'bg-emerald-50/90' : 'hover:bg-slate-50'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-extrabold text-slate-900 truncate">
                    {grp.namaKlien}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 mt-0.5">
                    {grp.tanggalLead} · {grp.invoiceNo}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 truncate">
                    {grp.items.map((i) => i.paket).join(', ')}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xs font-mono font-bold text-slate-900 tabular-nums">
                    {formatRpInvoice(grp.totalTagihan)}
                  </div>
                  <div
                    className={`text-[10px] font-bold mt-1 ${
                      isPaid ? 'text-emerald-700' : 'text-amber-600'
                    }`}
                  >
                    {isPaid ? 'LUNAS' : `Sisa ${formatRpInvoice(grp.sisa)}`}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right 8 Cols: Pinned Action Bar + Independently Scrollable Invoice Paper */}
      <div className="lg:col-span-8 flex flex-col gap-4 lg:h-full lg:overflow-hidden print:block">
        {/* Pinned Action Bar with Automatic Filename Preview */}
        <div className="shrink-0 bg-white border border-slate-200/90 rounded-2xl p-4 shadow-2xs print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="w-4 h-4 text-[#114232] shrink-0" />
              <div className="min-w-0">
                <div className="text-[11px] text-slate-400">
                  Nama File PDF Otomatis (Nama Pemesan - Tanggal Order - Nomor Invoice):
                </div>
                <div className="text-xs font-mono font-bold text-slate-900 truncate">
                  {pdfFilename}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {activeInvoice.sisa > 0 &&
                onQuickMarkPaidAndDone &&
                activeInvoice.items.length === 1 && (
                  <button
                    type="button"
                    onClick={() => onQuickMarkPaidAndDone(activeInvoice.items[0])}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tandai Lunas</span>
                  </button>
                )}

              <button
                type="button"
                onClick={handleCopyWa}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                {copiedWa ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Teks WA</span>
                  </>
                )}
              </button>

              {waUrl && (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>Kirim WA</span>
                </a>
              )}

              <button
                type="button"
                onClick={handleWindowPrint}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0d3326] rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PDF Invoice</span>
              </button>
            </div>
          </div>
        </div>

        {/* Independently Scrollable Paper Viewport */}
        <div className="flex-1 overflow-y-auto pb-8 pr-0.5 print:overflow-visible print:pb-0">
          {/* Exact 1:1 Paper Preview Matching Wanda & Adrian Serasa Salam Invoice PDF */}
          <div
            className="bg-white border border-slate-200/90 rounded-sm shadow-sm mx-auto max-w-[794px] p-8 sm:p-14 text-black print:shadow-none print:border-none print:p-0"
            style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
          >
            {/* 1. Top Row: INVOICE (Left) & Serasa Salam Undangan Lembang Logo (Right) */}
            <div className="flex items-center justify-between gap-4 mb-8">
              <h1 className="text-[34px] sm:text-[38px] font-bold tracking-normal text-black leading-none">
                INVOICE
              </h1>

              <img
                src={SERASA_SALAM_LOGO_DATA_URL}
                alt="Serasa Salam Undangan Lembang"
                className="h-11 sm:h-12 w-auto object-contain select-none"
              />
            </div>

            {/* 2. Metadata Row 1: No. Invoice & Tgl. Order: */}
            <div className="flex items-start justify-between gap-4 text-[13.5px] leading-snug mb-5">
              <div>
                <div className="font-bold text-black">No. Invoice</div>
                <div className="text-black mt-0.5">{activeInvoice.invoiceNo}</div>
              </div>

              <div className="text-right">
                <div className="font-bold text-black">Tgl. Order:</div>
                <div className="text-black mt-0.5">
                  {formatIndonesianFullDate(activeInvoice.tanggalLead)}
                </div>
              </div>
            </div>

            {/* 3. Metadata Row 2: Yth. & Deadline: */}
            <div className="flex items-start justify-between gap-4 text-[13.5px] leading-snug mb-4">
              <div>
                <div className="font-bold text-black">Yth.</div>
                <div className="text-black mt-0.5">{activeInvoice.namaKlien}</div>
              </div>

              <div className="text-right">
                <div className="font-bold text-black">Deadline:</div>
                <div className="text-black mt-0.5">
                  {formatIndonesianFullDate(
                    activeInvoice.deadline || activeInvoice.tanggalAcara
                  )}
                </div>
              </div>
            </div>

            {/* 4. 5-Row Striped Order Table Matching PDF Proportions */}
            <div className="border border-[#D9D9D9] mb-5">
              <table className="w-full border-collapse table-fixed text-[13.5px]">
                <colgroup>
                  <col className="w-[31.3%]" />
                  <col className="w-[18.0%]" />
                  <col className="w-[15.0%]" />
                  <col className="w-[35.7%]" />
                </colgroup>
                <thead>
                  <tr className="bg-[#D9D9D9] border-b border-[#8E8E8E] text-black font-bold">
                    <th className="py-1.5 px-2 text-center border-r border-[#D9D9D9]">
                      Nama Order
                    </th>
                    <th className="py-1.5 px-2 text-center border-r border-[#D9D9D9]">
                      Harga
                    </th>
                    <th className="py-1.5 px-2 text-center border-r border-[#D9D9D9]">
                      Qty
                    </th>
                    <th className="py-1.5 px-2 text-center">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {fiveTableSlots.map((slotItem, idx) => {
                    const isEvenStripe = idx % 2 === 1;
                    return (
                      <tr
                        key={idx}
                        className={`h-[64px] ${
                          isEvenStripe ? 'bg-[#F3F3F3]' : 'bg-white'
                        }`}
                      >
                        <td className="px-2 align-middle font-bold text-black text-left">
                          {slotItem ? slotItem.paket : ''}
                        </td>
                        <td className="px-2 align-middle font-normal text-black text-center">
                          {slotItem ? formatRpInvoice(slotItem.hargaPcs) : ''}
                        </td>
                        <td className="px-2 align-middle font-normal text-black text-center">
                          {slotItem ? slotItem.qty : ''}
                        </td>
                        <td className="px-2 align-middle font-bold text-black text-center">
                          {slotItem ? formatRpInvoice(slotItem.subtotal) : ''}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 5. Bottom Section: Left Terms/BCA & Right Summary/Catatan */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-6 text-[13.5px] leading-snug">
              {/* Left Column (Cols 1-6) */}
              <div className="sm:col-span-6 flex flex-col justify-between space-y-8">
                <div className="text-black">
                  <div>*Waktu produksi sesuai deadline tertera</div>
                  <div>dan ACC desain</div>
                </div>

                <div className="space-y-5">
                  <div className="text-black space-y-0.5">
                    <div>Pembayaran ke Rekening BCA</div>
                    <div className="font-bold">137 026 1136 a.n Rinaldy Harisma H</div>
                    <div>Diproses setelah ada pembayaran LUNAS</div>
                    <div>atau minimal DP 50%</div>
                  </div>

                  <div className="font-bold italic text-black space-y-0.5 pt-1">
                    <div>Terima Kasih</div>
                    <div>Atas Pesanan Anda</div>
                  </div>
                </div>
              </div>

              {/* Right Column (Cols 7-12): Summary Rows + Catatan Box */}
              <div className="sm:col-span-6 space-y-6">
                {/* Summary Block */}
                <div className="text-black">
                  {/* Sub Total */}
                  <div className="flex items-center justify-between bg-[#EFEFEF] border-b border-[#D9D9D9] px-1.5 py-1 font-bold">
                    <span>Sub Total</span>
                    <span>{formatRpInvoice(activeInvoice.subtotal)}</span>
                  </div>

                  {/* Disc. */}
                  <div className="flex items-center justify-between bg-white px-1.5 py-1">
                    <span>Disc.</span>
                    <span className="font-bold">
                      {formatRpInvoice(activeInvoice.diskon)}
                    </span>
                  </div>

                  {/* Blank row gap */}
                  <div className="h-4" />

                  {/* Total */}
                  <div className="flex items-center justify-between bg-[#EFEFEF] border-b border-[#D9D9D9] px-1.5 py-1 font-bold">
                    <span>Total</span>
                    <span>{formatRpInvoice(activeInvoice.totalTagihan)}</span>
                  </div>

                  {/* Bayar */}
                  <div className="flex items-center justify-between bg-white border-b border-[#D9D9D9] px-1.5 py-1">
                    <span>Bayar</span>
                    <span>{formatRpInvoice(activeInvoice.bayar)}</span>
                  </div>

                  {/* Sisa Bayar */}
                  <div className="flex items-center justify-between bg-[#EFEFEF] px-1.5 py-1 font-bold">
                    <span>Sisa Bayar</span>
                    <span>{formatRpInvoice(activeInvoice.sisa)}</span>
                  </div>
                </div>

                {/* Catatan Box */}
                <div>
                  <div className="italic text-black mb-1 px-0.5">Catatan</div>
                  <div className="border border-[#D9D9D9] min-h-[112px] p-2 font-bold italic text-black">
                    {activeInvoice.catatanGabungan || ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
