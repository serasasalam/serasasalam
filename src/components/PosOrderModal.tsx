import React, { useEffect, useMemo, useState } from 'react';
import {
  ClosingOrderItem,
  SERASA_CATALOG_PACKAGES,
} from '../services/serasaData';
import { generateNextInvoiceCode } from '../services/sheetsApi';
import { formatRupiah } from './BookkeepingSummary';
import { buildInvoicePdfFilename } from './InvoiceStudio';
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileDown,
  FileSpreadsheet,
  Phone,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  User,
  X,
} from 'lucide-react';

export interface PosLineItem {
  id: string;
  paket: string;
  qty: number;
  hargaPcs: number;
}

interface PosOrderModalProps {
  isOpen: boolean;
  isInline?: boolean;
  existingOrders: ClosingOrderItem[];
  nextInsertRow1Based: number;
  onClose?: () => void;
  onSaveRowsToTrackerClosing: (
    rowsToInsert: { rowNumber1Based: number; values: string[] }[],
    invoiceNo: string
  ) => void;
}

const MONTHS_SHORT_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
];

function formatDateSerasa(dateObj: Date): string {
  return `${dateObj.getDate()} ${MONTHS_SHORT_ID[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
}

const QUICK_NOTE_CHIPS = [
  'Desain Custom',
  'AP210',
  'Jasmine',
  'BC Tik',
  'Lipat',
  'Stiker Segel',
  'Plastik OPP',
  'Free Kartu Ucapan',
];

export const PosOrderModal: React.FC<PosOrderModalProps> = ({
  isOpen,
  isInline = false,
  existingOrders,
  nextInsertRow1Based,
  onClose,
  onSaveRowsToTrackerClosing,
}) => {
  const defaultNextInvoice = useMemo(() => {
    return generateNextInvoiceCode(existingOrders.map((o) => o.invoiceNo));
  }, [existingOrders]);

  const existingClientNames = useMemo(() => {
    const set = new Set<string>();
    for (let i = existingOrders.length - 1; i >= 0; i--) {
      const name = existingOrders[i].namaKlien.trim();
      if (name) set.add(name);
      if (set.size >= 25) break;
    }
    return Array.from(set);
  }, [existingOrders]);

  // Core Customer & Date fields
  const [namaKlien, setNamaKlien] = useState<string>('');
  const [noWa, setNoWa] = useState<string>('');
  const [tanggalLead, setTanggalLead] = useState<string>(() =>
    formatDateSerasa(new Date())
  );
  const [deadline, setDeadline] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 9);
    return formatDateSerasa(d);
  });
  const [invoiceNo, setInvoiceNo] = useState<string>(defaultNextInvoice);

  // Collapsible additional metadata (kept clean and out of the way unless needed)
  const [showAdvancedMeta, setShowAdvancedMeta] = useState<boolean>(false);
  const [jenisAcara, setJenisAcara] = useState<string>('Wedding');
  const [tanggalAcara, setTanggalAcara] = useState<string>('');
  const [channel, setChannel] = useState<string>('WhatsApp');
  const [statusOrder, setStatusOrder] = useState<string>('Desain');
  const [kodeMitra, setKodeMitra] = useState<string>('');

  // Catatan (Appears in the Catatan Box of the PDF Invoice & Col T of Tracker Closing)
  const [catatanUmum, setCatatanUmum] = useState<string>(
    'Desain Custom, AP210, Lipat, Stiker Segel'
  );

  // Order Line Items
  const [items, setItems] = useState<PosLineItem[]>([
    {
      id: 'item-1',
      paket: 'Undangan Cetak Premium',
      qty: 350,
      hargaPcs: 2300,
    },
  ]);

  // Billing & Payment Mode: 'belum_bayar' | 'dp' | 'lunas'
  const [extraDiscount, setExtraDiscount] = useState<number>(0);
  const [ongkir, setOngkir] = useState<number>(0);
  const [paymentMode, setPaymentMode] = useState<'belum_bayar' | 'dp' | 'lunas'>(
    'belum_bayar'
  );
  const [metodeBayar, setMetodeBayar] = useState<string>('Transfer');
  const [uangDiterima, setUangDiterima] = useState<string>('0');

  // Sync default invoice code when existingOrders count changes
  useEffect(() => {
    setInvoiceNo(defaultNextInvoice);
  }, [defaultNextInvoice]);

  // Totals calculation
  const subtotalAllItems = useMemo(() => {
    return items.reduce(
      (acc, it) => acc + Math.max(0, it.qty * it.hargaPcs),
      0
    );
  }, [items]);

  const totalDiscount = Math.max(0, extraDiscount);
  const grandTotal = Math.max(
    0,
    subtotalAllItems - totalDiscount + Math.max(0, ongkir)
  );

  // Automatically sync Uang Diterima when paymentMode changes
  useEffect(() => {
    if (paymentMode === 'lunas') {
      setUangDiterima(String(grandTotal));
    } else if (paymentMode === 'belum_bayar') {
      setUangDiterima('0');
    }
  }, [paymentMode, grandTotal]);

  const parsedUangDiterima =
    Number(String(uangDiterima).replace(/[^\d]/g, '')) || 0;
  const pembayaranMasuk =
    paymentMode === 'lunas'
      ? grandTotal
      : paymentMode === 'belum_bayar'
      ? 0
      : Math.min(grandTotal, parsedUangDiterima);
  const sisaTagihan = Math.max(0, grandTotal - pembayaranMasuk);

  const previewPdfFilename = useMemo(() => {
    return buildInvoicePdfFilename(
      namaKlien || 'Nama Pemesan',
      tanggalLead || 'Tanggal Order',
      invoiceNo || 'INV'
    );
  }, [namaKlien, tanggalLead, invoiceNo]);

  if (!isOpen) return null;

  const handleResetForm = () => {
    setInvoiceNo(defaultNextInvoice);
    setTanggalLead(formatDateSerasa(new Date()));
    setNamaKlien('');
    setNoWa('');
    setJenisAcara('Wedding');
    setTanggalAcara('');
    setChannel('WhatsApp');
    setStatusOrder('Desain');
    setKodeMitra('');
    setCatatanUmum('');
    setExtraDiscount(0);
    setOngkir(0);
    setPaymentMode('belum_bayar');
    setUangDiterima('0');
    setItems([
      {
        id: `item-${Date.now()}`,
        paket: 'Undangan Cetak Premium',
        qty: 350,
        hargaPcs: 2300,
      },
    ]);
  };

  const handleAddItem = (
    presetPaket?: string,
    presetHarga?: number,
    presetQty?: number
  ) => {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        paket: presetPaket || 'Undangan Digital',
        qty: presetQty ?? (presetPaket === 'Undangan Digital' ? 1 : 100),
        hargaPcs:
          presetHarga ?? (presetPaket === 'Undangan Digital' ? 70000 : 1000),
      },
    ]);
  };

  const handleUpdateItem = (id: string, patch: Partial<PosLineItem>) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const updated = { ...it, ...patch };
        if (patch.paket) {
          const foundPkg = SERASA_CATALOG_PACKAGES.find(
            (p) => p.paket === patch.paket
          );
          if (foundPkg) {
            updated.hargaPcs = foundPkg.hargaMulai;
            if (patch.paket === 'Undangan Digital') updated.qty = 1;
            else if (updated.qty <= 1) updated.qty = 100;
          }
        }
        return updated;
      })
    );
  };

  const handleRemoveItem = (id: string) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleToggleNoteChip = (chip: string) => {
    const current = catatanUmum.trim();
    if (!current) {
      setCatatanUmum(chip);
      return;
    }
    const parts = current
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.includes(chip)) {
      setCatatanUmum(parts.filter((p) => p !== chip).join(', '));
    } else {
      setCatatanUmum([...parts, chip].join(', '));
    }
  };

  const handleSaveOrder = (e: React.FormEvent) => {
    e.preventDefault();
    const clientNameClean = namaKlien.trim() || 'Pelanggan Umum';

    let remainingBayarToAllocate = pembayaranMasuk;

    const rowsToInsert = items.map((it, idx) => {
      const itemSubtotal = Math.max(0, it.qty * it.hargaPcs);
      const itemDiskon = idx === 0 ? extraDiscount : 0;
      const itemOngkir = idx === 0 ? ongkir : 0;
      const itemTotalTagihan = Math.max(
        0,
        itemSubtotal - itemDiskon + itemOngkir
      );

      const itemBayar =
        idx === items.length - 1
          ? remainingBayarToAllocate
          : Math.min(itemTotalTagihan, remainingBayarToAllocate);
      remainingBayarToAllocate = Math.max(
        0,
        remainingBayarToAllocate - itemBayar
      );
      const itemSisa = Math.max(0, itemTotalTagihan - itemBayar);

      // 21 Columns A-U of Tracker Closing:
      const rowValues: string[] = [
        invoiceNo.trim(),
        tanggalLead.trim(),
        clientNameClean,
        noWa.trim() || '0',
        jenisAcara,
        tanggalAcara.trim() || deadline.trim(),
        channel,
        it.paket,
        String(it.qty),
        String(it.hargaPcs),
        formatRupiah(itemSubtotal), // Col K: Rumus Sheet (skipped when writing)
        itemDiskon > 0 ? String(itemDiskon) : '',
        itemOngkir > 0 ? String(itemOngkir) : '0',
        formatRupiah(itemTotalTagihan), // Col N: Rumus Sheet (skipped when writing)
        itemBayar > 0 ? String(itemBayar) : '0',
        formatRupiah(itemSisa), // Col P: Rumus Sheet (skipped when writing)
        metodeBayar,
        statusOrder,
        deadline.trim(),
        catatanUmum.trim(),
        kodeMitra.trim(),
      ];

      return {
        rowNumber1Based: nextInsertRow1Based + idx,
        values: rowValues,
      };
    });

    onSaveRowsToTrackerClosing(rowsToInsert, invoiceNo.trim());
  };

  const content = (
    <div
      className={`bg-white border border-slate-200/90 rounded-3xl shadow-2xl overflow-hidden ${
        isInline
          ? 'w-full'
          : 'w-full max-w-[1140px] max-h-[90vh] flex flex-col'
      }`}
    >
      {/* Sticky Modal Header Bar (Never wraps awkwardly) */}
      <div className="shrink-0 flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#114232] text-white flex items-center justify-center shrink-0">
            <FileSpreadsheet className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Input Penjualan & Buat Invoice Baru
              </h2>
              <span className="px-2.5 py-0.5 text-[11px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full">
                Tracker Closing · Baris #{nextInsertRow1Based}
              </span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              Otomatis tersimpan ke Google Sheet & siap diunduh sebagai PDF Invoice
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleResetForm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>

          {!isInline && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Tutup form"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Form Body: Independent Scroll Area */}
      <form
        onSubmit={handleSaveOrder}
        className="flex-1 overflow-y-auto p-5 sm:p-6 bg-[#F4F7F5]"
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT 7 COLS: Step 1 (Pemesan), Step 2 (Item Order), Step 3 (Catatan) */}
          <div className="lg:col-span-7 space-y-5">
            {/* STEP 1: DATA PEMESAN & TANGGAL */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#114232] text-white text-xs font-extrabold flex items-center justify-center">
                    1
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Data Pemesan & Tanggal Invoice
                  </h3>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                  {invoiceNo}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Nama Pemesan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Nama Pemesan / Pengantin <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      list="serasa-existing-clients"
                      required
                      value={namaKlien}
                      onChange={(e) => setNamaKlien(e.target.value)}
                      placeholder="Contoh: Wanda & Adrian"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
                    />
                    <datalist id="serasa-existing-clients">
                      {existingClientNames.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* No. WhatsApp */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    No. WhatsApp (Opsional)
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={noWa}
                      onChange={(e) => setNoWa(e.target.value)}
                      placeholder="081234567890"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
                    />
                  </div>
                </div>

                {/* Tanggal Order */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Tanggal Order (Tgl. Order)
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={tanggalLead}
                      onChange={(e) => setTanggalLead(e.target.value)}
                      placeholder="Contoh: 12 Nov 2026"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
                    />
                  </div>
                </div>

                {/* Deadline */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Deadline Selesai Cetak
                  </label>
                  <div className="relative">
                    <Clock className="w-4 h-4 text-emerald-700 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                      placeholder="Contoh: 21 Nov 2026"
                      className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
                    />
                  </div>
                </div>
              </div>

              {/* Collapsible Extra Details so form stays simple */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdvancedMeta((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 text-emerald-700" />
                  <span>
                     Pengaturan Tambahan (No. Invoice, Acara: {jenisAcara}, Channel:{' '}
                    {channel})
                  </span>
                  {showAdvancedMeta ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {showAdvancedMeta && (
                  <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Nomor Invoice
                      </label>
                      <input
                        type="text"
                        value={invoiceNo}
                        onChange={(e) => setInvoiceNo(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Jenis Acara
                      </label>
                      <select
                        value={jenisAcara}
                        onChange={(e) => setJenisAcara(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      >
                        {['Wedding', 'Khitanan', 'Aqiqah', 'Tunangan', 'Lainnya'].map(
                          (ja) => (
                            <option key={ja} value={ja}>
                              {ja}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Tanggal Acara
                      </label>
                      <input
                        type="text"
                        value={tanggalAcara}
                        onChange={(e) => setTanggalAcara(e.target.value)}
                        placeholder="Opsional (27/12/2026)"
                        className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Channel Order
                      </label>
                      <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      >
                        {['WhatsApp', 'Instagram', 'TikTok', 'Mitra', 'Lainnya'].map(
                          (ch) => (
                            <option key={ch} value={ch}>
                              {ch}
                            </option>
                          )
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Status Produksi
                      </label>
                      <select
                        value={statusOrder}
                        onChange={(e) => setStatusOrder(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      >
                        {[
                          'Menunggu DP',
                          'Desain',
                          'Revisi',
                          'Cetak',
                          'Finishing',
                          'Dikirim',
                          'Selesai',
                        ].map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        Kode Mitra (Opsional)
                      </label>
                      <input
                        type="text"
                        value={kodeMitra}
                        onChange={(e) => setKodeMitra(e.target.value)}
                        placeholder="Kosongkan jika tanpa mitra"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* STEP 2: RINCIAN ITEM ORDER (NAMA ORDER, HARGA, QTY, JUMLAH) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-2xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#114232] text-white text-xs font-extrabold flex items-center justify-center">
                    2
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Rincian Pesanan Undangan
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#114232] bg-emerald-50 hover:bg-emerald-100 rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambah Baris Order</span>
                </button>
              </div>

              <div className="space-y-4">
                {items.map((it, idx) => {
                  const rowSubtotal = Math.max(0, it.qty * it.hargaPcs);
                  return (
                    <div
                      key={it.id}
                      className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/90 space-y-3.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-500 uppercase tracking-wider">
                          Item Order #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(it.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Hapus</span>
                          </button>
                        )}
                      </div>

                      {/* Quick Package Selector Pills */}
                      <div className="flex flex-wrap gap-1.5">
                        {SERASA_CATALOG_PACKAGES.map((pkg) => {
                          const isSelected = it.paket === pkg.paket;
                          return (
                            <button
                              key={pkg.paket}
                              type="button"
                              onClick={() =>
                                handleUpdateItem(it.id, { paket: pkg.paket })
                              }
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-[#114232] text-white shadow-2xs'
                                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {pkg.paket}
                            </button>
                          );
                        })}
                      </div>

                      {/* Nama Order + Harga + Qty + Jumlah Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                        {/* Nama Order (Editable text so custom names work too) */}
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Nama Order (Di Invoice)
                          </label>
                          <input
                            type="text"
                            value={it.paket}
                            onChange={(e) =>
                              handleUpdateItem(it.id, { paket: e.target.value })
                            }
                            placeholder="Ketik nama paket / produk..."
                            className="w-full px-3 py-2.5 text-xs font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#114232]"
                          />
                        </div>

                        {/* Harga / pcs */}
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Harga Satuan (Rp)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={it.hargaPcs}
                            onChange={(e) =>
                              handleUpdateItem(it.id, {
                                hargaPcs: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="w-full px-3 py-2.5 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#114232] tabular-nums"
                          />
                        </div>

                        {/* Qty (pcs) */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">
                            Qty (pcs)
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={it.qty}
                            onChange={(e) =>
                              handleUpdateItem(it.id, {
                                qty: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="w-full px-3 py-2.5 text-xs font-mono font-bold text-center bg-white border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:border-[#114232] tabular-nums"
                          />
                        </div>

                        {/* Jumlah Subtotal */}
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-bold text-slate-600 mb-1 sm:text-right">
                            Jumlah
                          </label>
                          <div className="px-2.5 py-2.5 text-xs font-mono font-extrabold text-slate-900 bg-emerald-50/70 border border-emerald-200/80 rounded-xl sm:text-right tabular-nums truncate">
                            {formatRupiah(rowSubtotal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: CATATAN INVOICE (MUNCUL DI KOTAK CATATAN PDF) */}
            <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-[#114232] text-white text-xs font-extrabold flex items-center justify-center">
                    3
                  </span>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    Catatan Pesanan (Tampil di Kotak Catatan Invoice)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-400">Kolom T Sheet</span>
              </div>

              {/* 1-Click Spec Chips */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_NOTE_CHIPS.map((chip) => {
                  const isActive = catatanUmum
                    .toLowerCase()
                    .includes(chip.toLowerCase());
                  return (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleToggleNoteChip(chip)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-950 border border-emerald-300'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {isActive ? `✓ ${chip}` : `+ ${chip}`}
                    </button>
                  );
                })}
              </div>

              <input
                type="text"
                value={catatanUmum}
                onChange={(e) => setCatatanUmum(e.target.value)}
                placeholder="Contoh: Desain Custom, AP210, Lipat, Stiker Segel"
                className="w-full px-3.5 py-2.5 text-xs font-bold italic bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-[#114232]"
              />
            </div>
          </div>

          {/* RIGHT 5 COLS: RINGKASAN TAGIHAN, PEMBAYARAN & TOMBOL SIMPAN */}
          <div className="lg:col-span-5 space-y-5 lg:sticky lg:top-0">
            <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
              {/* Green Header */}
              <div className="px-5 py-4 bg-[#114232] text-white">
                <div className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider">
                  Ringkasan Invoice & Pembayaran
                </div>
                <div className="text-2xl font-extrabold font-mono tabular-nums mt-1">
                  {formatRupiah(grandTotal)}
                </div>
                <div className="text-[11px] text-emerald-100/90 font-mono truncate mt-1">
                  PDF: {previewPdfFilename}
                </div>
              </div>

              <div className="p-5 space-y-4 text-xs">
                {/* Sub Total */}
                <div className="flex items-center justify-between text-slate-600">
                  <span className="font-semibold">Sub Total</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {formatRupiah(subtotalAllItems)}
                  </span>
                </div>

                {/* Diskon & Ongkir Side by Side */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Potongan Diskon (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={extraDiscount}
                      onChange={(e) =>
                        setExtraDiscount(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Ongkos Kirim (Rp)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={ongkir}
                      onChange={(e) =>
                        setOngkir(Math.max(0, Number(e.target.value) || 0))
                      }
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 tabular-nums"
                    />
                  </div>
                </div>

                {/* Status Pembayaran Selector (3 Clear Buttons) */}
                <div className="pt-3 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-800 mb-2">
                    Status Pembayaran Saat Ini:
                  </label>
                  <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('belum_bayar');
                        setUangDiterima('0');
                        setStatusOrder('Menunggu DP');
                      }}
                      className={`py-2 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        paymentMode === 'belum_bayar'
                          ? 'bg-[#114232] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Belum Bayar (Rp 0)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('dp');
                        setUangDiterima(String(Math.round(grandTotal * 0.5)));
                        setStatusOrder('Desain');
                      }}
                      className={`py-2 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        paymentMode === 'dp'
                          ? 'bg-[#114232] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      DP (Uang Muka)
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPaymentMode('lunas');
                        setUangDiterima(String(grandTotal));
                        setStatusOrder('Desain');
                      }}
                      className={`py-2 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer ${
                        paymentMode === 'lunas'
                          ? 'bg-[#114232] text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Lunas Penuh
                    </button>
                  </div>
                </div>

                {/* Nominal Bayar & Metode Bayar */}
                {paymentMode === 'dp' && (
                  <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-amber-950">
                        Nominal DP Diterima (Rp):
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setUangDiterima(String(Math.round(grandTotal * 0.5)))
                        }
                        className="text-[11px] font-bold text-amber-800 underline cursor-pointer"
                      >
                        Isi DP 50% ({formatRupiah(Math.round(grandTotal * 0.5))})
                      </button>
                    </div>
                    <input
                      type="number"
                      min={0}
                      value={uangDiterima}
                      onChange={(e) => setUangDiterima(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl text-slate-900 tabular-nums"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Metode Pembayaran
                  </label>
                  <select
                    value={metodeBayar}
                    onChange={(e) => setMetodeBayar(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 cursor-pointer"
                  >
                    <option value="Transfer">Transfer BCA (137 026 1136)</option>
                    <option value="Cash">Cash / Tunai</option>
                    <option value="QRIS">QRIS</option>
                  </select>
                </div>

                {/* Final Invoice Summary Box */}
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">Total</span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiah(grandTotal)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-semibold">Bayar</span>
                    <span className="font-mono font-bold text-emerald-700 tabular-nums">
                      {formatRupiah(pembayaranMasuk)}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-sm">
                    <span className="font-extrabold text-slate-900">Sisa Bayar</span>
                    <span
                      className={`font-mono font-extrabold tabular-nums ${
                        sisaTagihan > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {formatRupiah(sisaTagihan)}
                    </span>
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl bg-[#114232] hover:bg-[#0d3326] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Simpan ke Sheet & Buka PDF Invoice</span>
                  <FileDown className="w-4 h-4 ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );

  if (isInline) {
    return content;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
    >
      {content}
    </div>
  );
};
