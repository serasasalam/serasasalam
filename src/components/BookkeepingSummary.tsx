import React, { useMemo, useState } from 'react';
import { ColumnSchema, parseNumericCell } from '../services/sheetsApi';
import { Calculator, Filter, TrendingUp } from 'lucide-react';

interface BookkeepingSummaryProps {
  sheetTitle: string;
  columns: ColumnSchema[];
  rows: { rowNumber1Based: number; values: string[] }[];
}

export function formatRupiah(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatNumberId(num: number): string {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 2,
  }).format(num);
}

export const BookkeepingSummary: React.FC<BookkeepingSummaryProps> = ({
  sheetTitle,
  columns,
  rows,
}) => {
  // Detect all columns that actually contain numeric values
  const numericMetrics = useMemo(() => {
    return columns
      .map((col) => {
        if (col.inferredType === 'autonumber') return null;

        let sum = 0;
        let count = 0;
        let min = Infinity;
        let max = -Infinity;

        for (const row of rows) {
          const raw = row.values[col.index] || '';
          const parsed = parseNumericCell(raw);
          if (parsed !== null) {
            sum += parsed;
            count++;
            if (parsed < min) min = parsed;
            if (parsed > max) max = parsed;
          }
        }

        // Include if it was inferred as currency/number OR at least 30% of rows have valid numbers
        const threshold = Math.max(1, Math.floor(rows.length * 0.25));
        if (
          count >= threshold ||
          ((col.inferredType === 'currency' || col.inferredType === 'number') && count > 0)
        ) {
          return {
            col,
            sum,
            count,
            avg: count > 0 ? sum / count : 0,
            min: count > 0 ? min : 0,
            max: count > 0 ? max : 0,
            isCurrency:
              col.inferredType === 'currency' ||
              sum >= 10000 ||
              /(rp|harga|nominal|total|bayar|dp|sisa|masuk|keluar|saldo|kas|biaya|omzet|laba)/i.test(
                col.name
              ),
          };
        }
        return null;
      })
      .filter((m): m is NonNullable<typeof m> => m !== null);
  }, [columns, rows]);

  // Detect categorical columns for grouping breakdown
  const categoryColumns = useMemo(() => {
    return columns.filter(
      (c) =>
        c.inferredType === 'select' ||
        (c.inferredType === 'text' && c.uniqueValues.length >= 1 && c.uniqueValues.length <= 20)
    );
  }, [columns]);

  const [selectedCategoryColIdx, setSelectedCategoryColIdx] = useState<number | null>(null);
  const [selectedMetricColIdx, setSelectedMetricColIdx] = useState<number | null>(null);

  const activeCategoryCol = useMemo(() => {
    if (selectedCategoryColIdx !== null) {
      const found = categoryColumns.find((c) => c.index === selectedCategoryColIdx);
      if (found) return found;
    }
    return categoryColumns[0] || null;
  }, [categoryColumns, selectedCategoryColIdx]);

  const activeMetric = useMemo(() => {
    if (selectedMetricColIdx !== null) {
      const found = numericMetrics.find((m) => m.col.index === selectedMetricColIdx);
      if (found) return found;
    }
    return numericMetrics[0] || null;
  }, [numericMetrics, selectedMetricColIdx]);

  // Group breakdown by activeCategoryCol
  const breakdownItems = useMemo(() => {
    if (!activeCategoryCol) return [];
    const map = new Map<string, { label: string; count: number; sum: number }>();

    for (const row of rows) {
      const rawCat = (row.values[activeCategoryCol.index] || '').trim() || '(Tanpa Keterangan)';
      const existing = map.get(rawCat) || { label: rawCat, count: 0, sum: 0 };
      existing.count += 1;

      if (activeMetric) {
        const val = parseNumericCell(row.values[activeMetric.col.index] || '');
        if (val !== null) {
          existing.sum += val;
        }
      }
      map.set(rawCat, existing);
    }

    const list = Array.from(map.values());
    if (activeMetric) {
      list.sort((a, b) => b.sum - a.sum || b.count - a.count);
    } else {
      list.sort((a, b) => b.count - a.count);
    }
    return list;
  }, [activeCategoryCol, activeMetric, rows]);

  if (rows.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          Belum ada baris data transaksi pada tab &ldquo;{sheetTitle}&rdquo;.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Silakan gunakan menu Input Pembukuan untuk menambahkan data pertama Anda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Totals Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Rekapitulasi Angka & Keuangan — Tab {sheetTitle}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dihitung otomatis dari {rows.length} baris data aktif di Google Spreadsheet Anda
            </p>
          </div>
          <div className="text-xs text-slate-500 font-mono tabular-nums">
            Total Baris Data: <strong className="text-slate-900">{rows.length}</strong>
          </div>
        </div>

        {numericMetrics.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-500">
            Tidak ditemukan kolom nominal/angka pada tab ini. Pastikan kolom nominal berisi angka.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {numericMetrics.map((m) => (
              <div
                key={m.col.index}
                className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700 truncate">{m.col.name}</span>
                  <span className="font-mono text-slate-400 shrink-0">Kolom {m.col.letter}</span>
                </div>
                <div className="my-2.5 text-xl font-bold text-slate-900 font-mono tabular-nums tracking-tight">
                  {m.isCurrency ? formatRupiah(m.sum) : formatNumberId(m.sum)}
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-200/70 font-mono tabular-nums">
                  <span>{m.count} transaksi terisi</span>
                  <span>
                    Rata-rata: {m.isCurrency ? formatRupiah(m.avg) : formatNumberId(m.avg)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Category & Status Breakdown Table */}
      {activeCategoryCol && (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-200">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Rincian Berdasarkan Kategori / Status
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Kelompokkan pembukuan Serasa Salam Undangan berdasarkan kolom pilihan Anda
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                  Kelompokkan:
                </label>
                <select
                  value={activeCategoryCol.index}
                  onChange={(e) => setSelectedCategoryColIdx(Number(e.target.value))}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
                >
                  {categoryColumns.map((c) => (
                    <option key={c.index} value={c.index}>
                      {c.name} (Kolom {c.letter})
                    </option>
                  ))}
                </select>
              </div>

              {numericMetrics.length > 0 && activeMetric && (
                <div className="flex items-center gap-2">
                  <Calculator className="w-3.5 h-3.5 text-slate-400" />
                  <label className="text-xs font-medium text-slate-600 whitespace-nowrap">
                    Hitung Total:
                  </label>
                  <select
                    value={activeMetric.col.index}
                    onChange={(e) => setSelectedMetricColIdx(Number(e.target.value))}
                    className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-300 rounded-lg text-slate-800 focus:outline-none focus:border-emerald-600"
                  >
                    {numericMetrics.map((m) => (
                      <option key={m.col.index} value={m.col.index}>
                        {m.col.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2.5 pr-4">{activeCategoryCol.name}</th>
                  <th className="py-2.5 px-4 text-right">Jumlah Baris</th>
                  {activeMetric && (
                    <>
                      <th className="py-2.5 px-4 text-right">Total {activeMetric.col.name}</th>
                      <th className="py-2.5 pl-4 w-48">Proporsi</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {breakdownItems.map((item, idx) => {
                  const totalMetricSum = activeMetric ? Math.max(1, Math.abs(activeMetric.sum)) : 1;
                  const pct = activeMetric
                    ? Math.min(100, Math.round((Math.abs(item.sum) / totalMetricSum) * 100))
                    : Math.min(100, Math.round((item.count / Math.max(1, rows.length)) * 100));

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="py-3 pr-4 font-medium text-slate-900">{item.label}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums text-xs text-slate-600">
                        {item.count} baris
                      </td>
                      {activeMetric && (
                        <>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                            {activeMetric.isCurrency
                              ? formatRupiah(item.sum)
                              : formatNumberId(item.sum)}
                          </td>
                          <td className="py-3 pl-4">
                            <div className="flex items-center gap-2">
                              <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-emerald-600 rounded-full"
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs font-mono tabular-nums text-slate-500 w-9 text-right">
                                {pct}%
                              </span>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
