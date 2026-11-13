import React, { useState } from 'react';
import { SERASA_CATALOG_PACKAGES } from '../services/serasaData';
import { formatRupiah } from './BookkeepingSummary';
import { Calculator, CheckCircle2, Clock, Tag } from 'lucide-react';

interface PricingCalculatorViewProps {
  onOpenPosWithPreset: () => void;
}

export const PricingCalculatorView: React.FC<PricingCalculatorViewProps> = ({
  onOpenPosWithPreset,
}) => {
  const [selectedPaket, setSelectedPaket] = useState<string>('Undangan Cetak Premium');
  const [qty, setQty] = useState<number>(200);
  const [hargaPcs, setHargaPcs] = useState<number>(2300);
  const [diskon, setDiskon] = useState<number>(0);
  const [ongkir, setOngkir] = useState<number>(0);
  const [durasiHariKerja, setDurasiHariKerja] = useState<number>(9);

  const subtotal = Math.max(0, qty * hargaPcs);
  const totalTagihan = Math.max(0, subtotal - diskon + ongkir);
  const minimalDp = Math.round(totalTagihan * 0.5);

  const estimasiSelesai = (() => {
    const d = new Date();
    d.setDate(d.getDate() + durasiHariKerja);
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          Kalkulator Harga Cetak & Katalog Paket
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Hitung estimasi tagihan undangan cetak/digital, minimal DP 50%, dan estimasi deadline
          produksi sesuai standar SOP Serasa Salam.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Pricing Calculator */}
        <div className="lg:col-span-7 bg-white border border-slate-200/90 rounded-3xl p-6 space-y-5 shadow-2xs">
          <div className="flex items-center gap-2.5 pb-4 border-b border-slate-100">
            <div className="w-9 h-9 rounded-xl bg-[#114232] text-white flex items-center justify-center">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Simulasi Tagihan & Estimasi Produksi
              </h2>
              <p className="text-xs text-slate-500">
                Sesuai tab Pricing Calculator & Estimasi Produksi di Google Sheets
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Pilih Paket Undangan
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SERASA_CATALOG_PACKAGES.map((pkg) => {
                  const active = selectedPaket === pkg.paket;
                  return (
                    <button
                      key={pkg.paket}
                      type="button"
                      onClick={() => {
                        setSelectedPaket(pkg.paket);
                        setHargaPcs(pkg.hargaMulai);
                        if (pkg.paket === 'Undangan Digital') {
                          setQty(1);
                          setDurasiHariKerja(2);
                        } else {
                          if (qty <= 1) setQty(200);
                          setDurasiHariKerja(9);
                        }
                      }}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                        active
                          ? 'bg-[#114232] text-white border-[#114232] shadow-xs'
                          : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="text-xs font-extrabold">{pkg.paket}</div>
                      <div
                        className={`text-[11px] font-mono mt-1 ${
                          active ? 'text-emerald-200' : 'text-emerald-700 font-bold'
                        }`}
                      >
                        Mulai {formatRupiah(pkg.hargaMulai)}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Jumlah Pesanan / Qty (pcs)
              </label>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Harga Satuan / Pcs (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={hargaPcs}
                onChange={(e) => setHargaPcs(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Potongan Diskon (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={diskon}
                onChange={(e) => setDiskon(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimasi Ongkos Kirim (Rp)
              </label>
              <input
                type="number"
                min={0}
                value={ongkir}
                onChange={(e) => setOngkir(Math.max(0, Number(e.target.value) || 0))}
                className="w-full px-3.5 py-2.5 text-sm font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700 tabular-nums"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Estimasi Durasi Produksi (Hari Kerja: Desain + Revisi + Cetak + Finishing)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min={1}
                  max={21}
                  value={durasiHariKerja}
                  onChange={(e) => setDurasiHariKerja(Number(e.target.value))}
                  className="flex-1 accent-[#114232]"
                />
                <span className="px-3 py-1.5 rounded-xl bg-slate-100 font-mono text-xs font-bold text-slate-800">
                  {durasiHariKerja} Hari
                </span>
              </div>
            </div>
          </div>

          {/* Calculated Result Box */}
          <div className="p-5 rounded-2xl bg-[#114232] text-white space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-emerald-200">Subtotal</div>
                <div className="text-lg font-extrabold font-mono tabular-nums mt-0.5">
                  {formatRupiah(subtotal)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-emerald-200">Total Tagihan</div>
                <div className="text-xl font-extrabold font-mono tabular-nums mt-0.5 text-white">
                  {formatRupiah(totalTagihan)}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-amber-300 font-semibold">Minimal DP (50%)</div>
                <div className="text-lg font-extrabold font-mono tabular-nums mt-0.5 text-amber-300">
                  {formatRupiah(minimalDp)}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/15 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-emerald-100">
                <Clock className="w-4 h-4 text-emerald-300" />
                <span>
                  Target Deadline Selesai: <strong>{estimasiSelesai}</strong>
                </span>
              </div>

              <button
                type="button"
                onClick={onOpenPosWithPreset}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-white text-[#114232] font-extrabold text-xs hover:bg-emerald-50 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Buka Kasir POS & Buat Faktur</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 Cols: Daftar Paket Harga Reference */}
        <div className="lg:col-span-5 bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xs">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[#114232]" />
            <h3 className="text-base font-extrabold text-slate-900">
              Referensi Paket Harga (Tab Paket Harga)
            </h3>
          </div>

          <div className="space-y-3">
            {SERASA_CATALOG_PACKAGES.map((pkg) => (
              <div
                key={pkg.paket}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-slate-900">{pkg.paket}</span>
                  <span className="text-xs font-mono font-extrabold text-[#114232] bg-emerald-100 px-2.5 py-1 rounded-lg">
                    Mulai {formatRupiah(pkg.hargaMulai)}
                  </span>
                </div>
                <div className="text-[11px] font-semibold text-slate-500">
                  Target: {pkg.target} · Minimal Order: {pkg.minimal}
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">{pkg.fasilitas}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
