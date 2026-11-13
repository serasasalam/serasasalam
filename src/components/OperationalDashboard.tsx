import React, { useEffect, useMemo, useState } from 'react';
import { ClosingOrderItem } from '../services/serasaData';
import { formatRupiah } from './BookkeepingSummary';
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileDown,
  Plus,
} from 'lucide-react';

interface OperationalDashboardProps {
  orders: ClosingOrderItem[];
  onOpenPosModal: () => void;
  onNavigate: (view: string) => void;
  onSelectInvoice: (invoiceNo: string) => void;
}

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov'];

function extractMonthKey(dateStr: string): string {
  if (!dateStr) return 'Lainnya';
  const s = dateStr.trim();

  // Check DD/MM/YYYY
  const slashMatch = s.match(/^\d{1,2}\/(\d{1,2})\/\d{2,4}$/);
  if (slashMatch) {
    const mIdx = parseInt(slashMatch[1], 10) - 1;
    if (mIdx >= 0 && mIdx < 12) return MONTH_LABELS[mIdx] || 'Nov';
  }

  // Check Indonesian month name: "12 Nov 2026", "7 Apr 2026", "4 Agu 2026"
  for (const m of MONTH_LABELS) {
    if (new RegExp(`\\b${m}`, 'i').test(s)) {
      return m;
    }
  }
  if (/des/i.test(s)) return 'Des';
  return 'Lainnya';
}

export const OperationalDashboard: React.FC<OperationalDashboardProps> = ({
  orders,
  onOpenPosModal,
  onNavigate,
  onSelectInvoice,
}) => {
  const [chartTab, setChartTab] = useState<'bulanan' | 'paket'>('bulanan');
  const [clockStr, setClockStr] = useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Jakarta',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setClockStr(
        new Date().toLocaleTimeString('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Core Sales KPIs computed live from Tracker Closing in Google Sheets
  const metrics = useMemo(() => {
    const totalOmzetOrder = orders.reduce((acc, o) => acc + o.totalTagihan, 0);
    const bayarOrderMasuk = orders.reduce((acc, o) => acc + o.bayar, 0);
    const totalPiutang = orders.reduce((acc, o) => acc + o.sisa, 0);
    const belumLunasCount = orders.filter((o) => o.sisa > 0).length;
    const lunasCount = orders.filter((o) => o.sisa <= 0).length;
    const uniqueInvoices = new Set(orders.map((o) => o.invoiceNo).filter(Boolean)).size;

    return {
      totalOmzetOrder,
      bayarOrderMasuk,
      totalPiutang,
      belumLunasCount,
      lunasCount,
      uniqueInvoices,
    };
  }, [orders]);

  // Chart data for last 6 active months (Omzet vs Uang Masuk Bayar)
  const monthlyChartData = useMemo(() => {
    const targetMonths = ['Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Okt', 'Nov'];
    const map = new Map<string, { label: string; omzet: number; bayar: number }>();
    for (const m of targetMonths) {
      map.set(m, { label: m, omzet: 0, bayar: 0 });
    }

    for (const o of orders) {
      const m = extractMonthKey(o.tanggalLead);
      if (map.has(m)) {
        map.get(m)!.omzet += o.totalTagihan;
        map.get(m)!.bayar += o.bayar;
      }
    }

    const list = Array.from(map.values()).slice(-6);
    const maxVal = Math.max(
      1,
      ...list.map((d) => Math.max(d.omzet, d.bayar))
    );
    let highestIdx = 0;
    list.forEach((d, idx) => {
      if (d.omzet > list[highestIdx].omzet) highestIdx = idx;
    });

    return { list, maxVal, highestIdx };
  }, [orders]);

  // Latest orders for quick PDF Invoice download
  const recentInvoices = useMemo(() => {
    return [...orders].reverse().slice(0, 5);
  }, [orders]);

  // Unpaid DP / Piutang reminder order
  const urgentDpOrder = useMemo(() => {
    const dpOrders = orders.filter((o) => o.sisa > 0).reverse();
    return dpOrders[0] || orders[orders.length - 1] || null;
  }, [orders]);

  // Package breakdown
  const packageStats = useMemo(() => {
    const map = new Map<string, { paket: string; count: number; omzet: number }>();
    for (const o of orders) {
      const pkg = o.paket || 'Lainnya';
      const cur = map.get(pkg) || { paket: pkg, count: 0, omzet: 0 };
      cur.count += 1;
      cur.omzet += o.totalTagihan;
      map.set(pkg, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.omzet - a.omzet);
  }, [orders]);

  const lunasPct =
    orders.length > 0 ? Math.round((metrics.lunasCount / orders.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Top Heading & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Dasbor Penjualan & Invoice
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pencatatan penjualan (Tracker Closing) & pembuatan PDF Invoice otomatis yang terhubung
            langsung ke Google Spreadsheet.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenPosModal}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Input Penjualan Baru</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('invoice')}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-full shadow-2xs transition-colors cursor-pointer"
          >
            <FileDown className="w-4 h-4 text-[#114232]" />
            <span>Buat & Unduh PDF Invoice</span>
          </button>
        </div>
      </div>

      {/* 4 Hero Sales KPI Cards (Strictly from Tracker Closing) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        {/* Card 1: Total Penjualan (Tracker Closing) */}
        <div
          onClick={() => onNavigate('closing')}
          className="p-6 rounded-3xl bg-[#114232] text-white flex flex-col justify-between shadow-sm cursor-pointer hover:bg-[#0e382a] transition-colors min-h-[168px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100/90">
              Total Penjualan (Tracker Closing)
            </span>
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold font-mono tabular-nums tracking-tight my-3">
            {formatRupiah(metrics.totalOmzetOrder)}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-200 font-medium">
              {metrics.uniqueInvoices} Faktur · {orders.length} Baris Order
            </span>
            <span className="text-emerald-200 font-semibold hover:underline">Buka Tabel &rsaquo;</span>
          </div>
        </div>

        {/* Card 2: Uang Masuk Pembayaran Order */}
        <div
          onClick={() => onNavigate('closing')}
          className="p-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-slate-300 transition-colors min-h-[168px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Pembayaran Diterima (Bayar)
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight my-3">
            {formatRupiah(metrics.bayarOrderMasuk)}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-700">
              Uang masuk dari pesanan
            </span>
            <span className="text-slate-400 font-semibold">Detail &rsaquo;</span>
          </div>
        </div>

        {/* Card 3: Sisa Tagihan / Piutang DP */}
        <div
          onClick={() => onNavigate('piutang')}
          className="p-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-slate-300 transition-colors min-h-[168px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Sisa Tagihan (DP / Belum Lunas)
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight my-3">
            {formatRupiah(metrics.totalPiutang)}
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-amber-700">
              {metrics.belumLunasCount} Pesanan menunggu pelunasan
            </span>
            <span className="text-slate-400 font-semibold">Lihat DP &rsaquo;</span>
          </div>
        </div>

        {/* Card 4: Pesanan Lunas & Cetak PDF Invoice */}
        <div
          onClick={() => onNavigate('invoice')}
          className="p-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col justify-between shadow-2xs cursor-pointer hover:border-slate-300 transition-colors min-h-[168px]"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">
              Faktur Siap Unduh PDF
            </span>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
              <FileDown className="w-4 h-4" />
            </div>
          </div>

          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-mono tabular-nums tracking-tight my-3">
            {metrics.uniqueInvoices} Invoice
          </div>

          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-emerald-700">
              {metrics.lunasCount} Lunas · {metrics.belumLunasCount} DP
            </span>
            <span className="text-slate-400 font-semibold">Unduh PDF &rsaquo;</span>
          </div>
        </div>
      </div>

      {/* Middle Row: 3 Bento Cards (Sales Chart 6 Cols + Pengingat Pelunasan 3 Cols + Faktur PDF Cepat 3 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left 6 Cols: Analisis Penjualan Tracker Closing */}
        <div className="lg:col-span-6 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Grafik Penjualan (Tracker Closing)
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Perbandingan total tagihan omzet vs pembayaran diterima per bulan
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
              {[
                { key: 'bulanan', label: 'Bulanan' },
                { key: 'paket', label: 'Per Paket' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setChartTab(t.key as 'bulanan' | 'paket')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    chartTab === t.key
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {chartTab === 'bulanan' ? (
            <div className="pt-10 pb-4 px-2">
              <div className="h-44 flex items-end justify-between gap-3">
                {monthlyChartData.list.map((d, idx) => {
                  const omzetHeight = Math.max(
                    10,
                    Math.round((d.omzet / monthlyChartData.maxVal) * 145)
                  );
                  const bayarHeight = Math.max(
                    10,
                    Math.round((d.bayar / monthlyChartData.maxVal) * 145)
                  );
                  const isHighest = idx === monthlyChartData.highestIdx;

                  return (
                    <div
                      key={d.label}
                      className="flex-1 flex flex-col items-center gap-2 relative"
                    >
                      {isHighest && (
                        <div className="-top-7 px-2 py-0.5 rounded-full bg-[#114232] text-white text-[10px] font-bold whitespace-nowrap shadow-xs">
                          Tertinggi
                        </div>
                      )}
                      <div className="flex items-end gap-1.5 h-36">
                        <div
                          style={{ height: `${omzetHeight}px` }}
                          title={`Total Omzet ${d.label}: ${formatRupiah(d.omzet)}`}
                          className={`w-3.5 sm:w-4 rounded-full transition-all ${
                            isHighest ? 'bg-[#114232]' : 'bg-emerald-600'
                          }`}
                        />
                        <div
                          style={{ height: `${bayarHeight}px` }}
                          title={`Uang Masuk ${d.label}: ${formatRupiah(d.bayar)}`}
                          className="w-3.5 sm:w-4 rounded-full bg-emerald-200 transition-all"
                        />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-400">
                        {d.label} 26
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="py-5 space-y-3">
              {packageStats.slice(0, 5).map((p) => {
                const pct = Math.min(
                  100,
                  Math.round(
                    (p.omzet / Math.max(1, metrics.totalOmzetOrder)) * 100
                  )
                );
                return (
                  <div key={p.paket} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800">
                        {p.paket} ({p.count} order)
                      </span>
                      <span className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatRupiah(p.omzet)}
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#114232] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#114232] inline-block" />
              <span className="text-slate-500">
                Total Omzet:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">
                  {formatRupiah(metrics.totalOmzetOrder)}
                </strong>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300 inline-block" />
              <span className="text-slate-500">
                Sudah Dibayar:{' '}
                <strong className="text-slate-900 font-mono tabular-nums">
                  {formatRupiah(metrics.bayarOrderMasuk)}
                </strong>
              </span>
            </div>
          </div>
        </div>

        {/* Middle 3 Cols: PENGINGAT TAGIHAN / DEADLINE */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase">
                STATUS PEMBAYARAN & DEADLINE
              </span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>

            {urgentDpOrder ? (
              <>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                    {urgentDpOrder.namaKlien}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Paket: <strong className="text-slate-800">{urgentDpOrder.paket}</strong> (
                    {urgentDpOrder.qty} pcs)
                  </p>
                  <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                    {urgentDpOrder.invoiceNo} · Order: {urgentDpOrder.tanggalLead}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/80 space-y-1">
                  <div className="text-[11px] font-semibold text-amber-700">
                    Sisa Tagihan / Deadline:
                  </div>
                  <div className="text-sm font-extrabold font-mono text-amber-900 tabular-nums">
                    {urgentDpOrder.sisa > 0
                      ? `Sisa ${formatRupiah(urgentDpOrder.sisa)}`
                      : 'Lunas Penuh'}
                  </div>
                  <div className="text-[11px] font-semibold text-amber-800">
                    Deadline: {urgentDpOrder.deadline || urgentDpOrder.tanggalAcara || '-'}
                  </div>
                </div>
              </>
            ) : (
              <p className="text-xs text-slate-500">Belum ada data pesanan.</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              if (urgentDpOrder) {
                onSelectInvoice(urgentDpOrder.invoiceNo);
              }
              onNavigate('invoice');
            }}
            className="mt-5 w-full py-3 px-4 rounded-full bg-[#114232] hover:bg-[#0c3124] text-white text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Buka & Unduh PDF Invoice</span>
          </button>
        </div>

        {/* Right 3 Cols: FAKTUR & INVOICE TERBARU */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-[11px] font-extrabold text-slate-400 tracking-wider uppercase">
                CETAK PDF CEPAT
              </span>
              <button
                type="button"
                onClick={onOpenPosModal}
                className="text-xs font-extrabold text-slate-800 hover:text-emerald-800 cursor-pointer"
              >
                + Input Baru
              </button>
            </div>

            <div className="space-y-3.5">
              {recentInvoices.slice(0, 4).map((item) => {
                const isPaid = item.sisa <= 0;
                return (
                  <div
                    key={item.rowNumber1Based}
                    onClick={() => {
                      onSelectInvoice(item.invoiceNo);
                      onNavigate('invoice');
                    }}
                    className="flex items-center justify-between gap-2 cursor-pointer group"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-extrabold text-slate-900 group-hover:text-emerald-800 truncate">
                        {item.namaKlien}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate font-mono">
                        {item.tanggalLead} · {item.invoiceNo}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                        isPaid
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-amber-50 text-amber-800'
                      }`}
                    >
                      PDF &rsaquo;
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 mt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => onNavigate('invoice')}
              className="text-xs font-extrabold text-slate-800 hover:text-emerald-800 cursor-pointer"
            >
              Pilih Semua Nomor Invoice &rarr;
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Pelanggan Terbaru (5 Cols) + Rasio Pelunasan Order (4 Cols) + Shift Operasional Clock (3 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Pelanggan & Order Terbaru */}
        <div className="lg:col-span-5 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Penjualan Terbaru (Tracker Closing)
                </h3>
                <p className="text-xs text-slate-500">
                  Klik nama pemesan untuk langsung mengunduh PDF Invoice
                </p>
              </div>
              <button
                type="button"
                onClick={onOpenPosModal}
                className="px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
              >
                + Order
              </button>
            </div>

            <div className="space-y-3">
              {[...orders]
                .slice(-4)
                .reverse()
                .map((o) => {
                  const initial = (o.namaKlien || 'S').charAt(0).toUpperCase();
                  return (
                    <div
                      key={o.rowNumber1Based}
                      onClick={() => {
                        onSelectInvoice(o.invoiceNo);
                        onNavigate('invoice');
                      }}
                      className="flex items-center justify-between gap-3 p-2.5 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#114232] text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-extrabold text-slate-900 truncate">
                            {o.namaKlien}
                          </div>
                          <div className="text-[11px] text-slate-500 truncate">
                            {o.paket} ({o.qty} pcs · {formatRupiah(o.totalTagihan)})
                          </div>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-lg shrink-0 ${
                          o.sisa > 0
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {o.sisa > 0 ? 'DP Piutang' : 'Lunas'}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        </div>

        {/* Status Pembayaran Order */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Status Pelunasan Penjualan
              </h3>
              <p className="text-xs text-slate-500">
                Rasio pesanan lunas dari total {orders.length} transaksi di Sheet
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 space-y-2">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-bold text-slate-700">Pesanan Lunas</span>
                <span className="text-xl font-extrabold font-mono text-[#114232] tabular-nums">
                  {lunasPct}% ({metrics.lunasCount}/{orders.length})
                </span>
              </div>
              <div className="h-3 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#114232] rounded-full"
                  style={{ width: `${lunasPct}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200/70">
                <div className="text-emerald-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sudah Lunas</span>
                </div>
                <div className="text-lg font-extrabold font-mono text-emerald-900 mt-0.5 tabular-nums">
                  {metrics.lunasCount} Order
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70">
                <div className="text-amber-700 font-semibold">Belum Lunas (DP)</div>
                <div className="text-lg font-extrabold font-mono text-amber-900 mt-0.5 tabular-nums">
                  {metrics.belumLunasCount} Order
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Shift Operasional Live Clock Card */}
        <div className="lg:col-span-3 p-6 rounded-3xl bg-[#114232] text-white flex flex-col justify-between shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold text-emerald-200/80 tracking-wider uppercase">
              TRACKER CLOSING SYNC
            </span>
            <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-200 text-[10px] font-bold">
              Google Sheet Aktif
            </span>
          </div>

          <div className="my-6 text-center">
            <div className="text-3xl sm:text-4xl font-extrabold font-mono tabular-nums tracking-wider">
              {clockStr}
            </div>
            <div className="text-xs text-emerald-200/80 mt-1.5">
              Waktu Indonesia Barat (WIB)
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenPosModal}
            className="w-full py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            + Input Penjualan Baru
          </button>
        </div>
      </div>
    </div>
  );
};
