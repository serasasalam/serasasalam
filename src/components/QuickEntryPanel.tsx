import React, { useEffect, useMemo, useState } from 'react';
import {
  ColumnSchema,
  parseNumericCell,
  SERASA_TAB_RULES,
} from '../services/sheetsApi';
import { formatRupiah } from './BookkeepingSummary';
import {
  Calculator,
  Calendar,
  Copy,
  Edit3,
  Hash,
  PlusCircle,
  RotateCcw,
} from 'lucide-react';

interface QuickEntryPanelProps {
  spreadsheetId: string;
  sheetTitle: string;
  nextInsertRow1Based: number;
  columns: ColumnSchema[];
  rows: { rowNumber1Based: number; values: string[] }[];
  onSubmitNewRow: (values: string[]) => void;
  onEditExistingRow: (rowNumber1Based: number, currentValues: string[]) => void;
}

const MONTHS_ID = [
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

function getTodayForSheet(sheetTitle: string, existingSamples: string[]): string {
  const now = new Date();
  const ddNum = now.getDate();
  const ddPad = String(ddNum).padStart(2, '0');
  const mmPad = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = now.getFullYear();
  const monthName = MONTHS_ID[now.getMonth()];

  if (sheetTitle === 'PO Ganci') {
    return `${ddPad}/${mmPad}/${yyyy}`;
  }

  const sample = existingSamples[existingSamples.length - 1] || '';
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(sample)) {
    return `${ddPad}/${mmPad}/${yyyy}`;
  }

  // Default Serasa Salam format: "12 Nov 2026"
  return `${ddNum} ${monthName} ${yyyy}`;
}

export const QuickEntryPanel: React.FC<QuickEntryPanelProps> = ({
  sheetTitle,
  nextInsertRow1Based,
  columns,
  rows,
  onSubmitNewRow,
  onEditExistingRow,
}) => {
  const tabRule = SERASA_TAB_RULES[sheetTitle];

  const buildDefaultValues = () => {
    return columns.map((col) => {
      if (col.isFormulaColumn) return '';
      if (col.inferredType === 'invoice' && col.nextInvoiceCode) {
        return col.nextInvoiceCode;
      }
      if (col.inferredType === 'autonumber' && col.nextAutoNumber !== undefined) {
        return String(col.nextAutoNumber);
      }
      if (
        col.inferredType === 'date' &&
        /(tanggal\s*lead|tgl\s*po|^tanggal$|tgl\s*bergabung)/i.test(col.name.trim())
      ) {
        return getTodayForSheet(sheetTitle, col.uniqueValues);
      }
      if (sheetTitle === 'Tracker Closing') {
        if (col.name === 'Jenis Acara') return 'Wedding';
        if (col.name === 'Channel') return 'WhatsApp';
        if (col.name === 'Status') return 'Menunggu DP';
        if (col.name === 'Metode Bayar') return 'Transfer';
      }
      if (sheetTitle === 'PO Ganci') {
        if (col.name === 'QTY') return '1';
        if (col.name === 'Harga') return '8000';
        if (col.name === 'Status') return 'PO';
        if (col.name === 'Bayar') return 'LUNAS';
      }
      if (
        (sheetTitle === 'Pemasukan Diluar Undangan' || sheetTitle === 'Pengeluaran') &&
        col.name === 'Tipe Bayar'
      ) {
        return 'Transfer';
      }
      return '';
    });
  };

  const [formValues, setFormValues] = useState<string[]>(() => buildDefaultValues());

  useEffect(() => {
    setFormValues(buildDefaultValues());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetTitle, columns.length, rows.length]);

  const handleFieldChange = (colIndex: number, val: string) => {
    setFormValues((prev) => {
      const next = [...prev];
      next[colIndex] = val;
      return next;
    });
  };

  const handleAddNominal = (colIndex: number, delta: number) => {
    setFormValues((prev) => {
      const next = [...prev];
      const currentNum = parseNumericCell(next[colIndex] || '') || 0;
      const updated = Math.max(0, currentNum + delta);
      next[colIndex] = String(updated);
      return next;
    });
  };

  const handleDuplicateFromRow = (rowValues: string[]) => {
    const next = columns.map((col, idx) => {
      if (col.isFormulaColumn) return '';
      if (col.inferredType === 'invoice' && col.nextInvoiceCode) {
        return col.nextInvoiceCode;
      }
      if (col.inferredType === 'autonumber' && col.nextAutoNumber !== undefined) {
        return String(col.nextAutoNumber);
      }
      return rowValues[idx] || '';
    });
    setFormValues(next);
  };

  // Live Preview Calculation for Blue Formula Columns ("Kolom Biru")
  const liveFormulaPreview = useMemo(() => {
    const result: Record<number, string> = {};

    if (sheetTitle === 'Tracker Closing') {
      // I (8): Qty, J (9): Harga/pcs, K (10): Subtotal, L (11): Diskon, M (12): Ongkir, N (13): Total Tagihan, O (14): Bayar, P (15): Sisa
      const qty = parseNumericCell(formValues[8] || '') || 0;
      const hargaPcs = parseNumericCell(formValues[9] || '') || 0;
      const diskon = parseNumericCell(formValues[11] || '') || 0;
      const ongkir = parseNumericCell(formValues[12] || '') || 0;
      const bayar = parseNumericCell(formValues[14] || '') || 0;

      const subtotal = qty * hargaPcs;
      const totalTagihan = Math.max(0, subtotal - diskon + ongkir);
      const sisa = Math.max(0, totalTagihan - bayar);

      result[10] = formatRupiah(subtotal);
      result[13] = formatRupiah(totalTagihan);
      result[15] = formatRupiah(sisa);
    } else if (sheetTitle === 'PO Ganci') {
      // F (5): Harga, G (6): QTY, H (7): Total
      const harga = parseNumericCell(formValues[5] || '') || 0;
      const qty = parseNumericCell(formValues[6] || '') || 0;
      result[7] = formatRupiah(harga * qty);
    }

    return result;
  }, [sheetTitle, formValues]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalValues = columns.map((col, idx) => {
      if (col.isFormulaColumn) {
        return liveFormulaPreview[col.index] || '(Rumus Otomatis Sheet)';
      }
      return (formValues[idx] ?? '').trim();
    });
    onSubmitNewRow(finalValues);
  };

  const recentRows = useMemo(() => {
    return [...rows].slice(-10).reverse();
  }, [rows]);

  const lastInvoiceInSheet = useMemo(() => {
    if (sheetTitle !== 'Tracker Closing' || rows.length === 0) return null;
    return rows[rows.length - 1]?.values[0] || null;
  }, [sheetTitle, rows]);

  if (columns.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <p className="text-sm font-medium text-slate-700">
          Tab &ldquo;{sheetTitle}&rdquo; adalah lembar referensi/ringkasan.
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Pilih tab operasional seperti <strong>Tracker Closing</strong>, <strong>PO Ganci</strong>,{' '}
          <strong>Pemasukan Diluar Undangan</strong>, atau <strong>Pengeluaran</strong> untuk input
          data harian.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 7 Cols: Tailored Input Form */}
      <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div>
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
              <span>Input ke Tab: {sheetTitle}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">Target Baris #{nextInsertRow1Based}</span>
            </div>
            <h2 className="text-base font-bold text-slate-900 mt-0.5">
              Form Input Pembukuan — {sheetTitle}
            </h2>
            {tabRule?.description && (
              <p className="text-xs text-slate-500 mt-0.5">{tabRule.description}</p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setFormValues(buildDefaultValues())}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Form</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Yellow Input Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {columns.map((col) => {
              // Render Formula Columns ("Kolom Biru") in a dedicated read-only summary box below
              if (col.isFormulaColumn) {
                return null;
              }

              const val = formValues[col.index] ?? '';
              const parsedCurrency =
                col.inferredType === 'currency' ? parseNumericCell(val) : null;

              const isFullWidth =
                col.inferredType === 'select' ||
                col.inferredType === 'currency' ||
                col.inferredType === 'invoice' ||
                /(keterangan|catatan|nama\s*klien|nama\s*order|teks)/i.test(col.name);

              return (
                <div
                  key={col.index}
                  className={isFullWidth ? 'sm:col-span-2 space-y-1.5' : 'space-y-1.5'}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-slate-800">
                      {col.name}{' '}
                      <span className="font-mono font-normal text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
                        Kolom {col.letter} (Input)
                      </span>
                    </label>

                    {/* Quick helper for No. Invoice */}
                    {col.inferredType === 'invoice' && (
                      <div className="flex items-center gap-2">
                        {col.nextInvoiceCode && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange(col.index, col.nextInvoiceCode!)}
                            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:underline"
                          >
                            <Hash className="w-3 h-3" />
                            <span>No. Baru ({col.nextInvoiceCode})</span>
                          </button>
                        )}
                        {lastInvoiceInSheet && (
                          <button
                            type="button"
                            onClick={() => handleFieldChange(col.index, lastInvoiceInSheet)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline"
                            title="Gunakan nomor invoice yang sama jika 1 klien memesan beberapa item"
                          >
                            Gabung Invoice Terakhir ({lastInvoiceInSheet})
                          </button>
                        )}
                      </div>
                    )}

                    {/* Quick helper for Date */}
                    {col.inferredType === 'date' && (
                      <button
                        type="button"
                        onClick={() =>
                          handleFieldChange(
                            col.index,
                            getTodayForSheet(sheetTitle, col.uniqueValues)
                          )
                        }
                        className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-800"
                      >
                        <Calendar className="w-3 h-3" />
                        <span>Isi Hari Ini</span>
                      </button>
                    )}

                    {col.inferredType === 'currency' && parsedCurrency !== null && (
                      <span className="text-xs font-mono font-semibold text-emerald-700 tabular-nums">
                        {formatRupiah(parsedCurrency)}
                      </span>
                    )}
                  </div>

                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleFieldChange(col.index, e.target.value)}
                    placeholder={
                      col.inferredType === 'currency'
                        ? 'Contoh: 250000'
                        : col.inferredType === 'date'
                        ? `Contoh: ${getTodayForSheet(sheetTitle, col.uniqueValues)}`
                        : `Isi ${col.name}...`
                    }
                    className={`w-full px-3.5 py-2 text-sm bg-amber-50/20 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15 ${
                      col.inferredType === 'currency' ||
                      col.inferredType === 'number' ||
                      col.inferredType === 'autonumber' ||
                      col.inferredType === 'invoice'
                        ? 'font-mono tabular-nums'
                        : ''
                    }`}
                  />

                  {/* Quick Nominal Buttons for Currency Columns */}
                  {col.inferredType === 'currency' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {sheetTitle === 'Tracker Closing' && col.name === 'Harga/pcs'
                        ? [
                            { label: 'Rp1.000 (Basic)', val: '1000' },
                            { label: 'Rp1.200', val: '1200' },
                            { label: 'Rp2.300 (Premium)', val: '2300' },
                            { label: 'Rp5.000', val: '5000' },
                            { label: 'Rp20.000 (Digital)', val: '20000' },
                            { label: 'Rp70.000 (Digital)', val: '70000' },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() => handleFieldChange(col.index, preset.val)}
                              className="px-2 py-1 text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                            >
                              {preset.label}
                            </button>
                          ))
                        : [
                            { label: '+10rb', delta: 10000 },
                            { label: '+50rb', delta: 50000 },
                            { label: '+100rb', delta: 100000 },
                            { label: '+250rb', delta: 250000 },
                            { label: '+500rb', delta: 500000 },
                          ].map((btn) => (
                            <button
                              key={btn.label}
                              type="button"
                              onClick={() => handleAddNominal(col.index, btn.delta)}
                              className="px-2 py-1 text-xs font-mono font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors cursor-pointer"
                            >
                              {btn.label}
                            </button>
                          ))}

                      {/* In Tracker Closing, allow 1-click "Bayar Lunas" on Bayar column */}
                      {sheetTitle === 'Tracker Closing' && col.name === 'Bayar' && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              const qty = parseNumericCell(formValues[8] || '') || 0;
                              const hrg = parseNumericCell(formValues[9] || '') || 0;
                              const dsk = parseNumericCell(formValues[11] || '') || 0;
                              const onk = parseNumericCell(formValues[12] || '') || 0;
                              const tot = Math.max(0, qty * hrg - dsk + onk);
                              handleFieldChange(col.index, String(Math.round(tot * 0.5)));
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-md transition-colors cursor-pointer"
                          >
                            DP 50%
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const qty = parseNumericCell(formValues[8] || '') || 0;
                              const hrg = parseNumericCell(formValues[9] || '') || 0;
                              const dsk = parseNumericCell(formValues[11] || '') || 0;
                              const onk = parseNumericCell(formValues[12] || '') || 0;
                              const tot = Math.max(0, qty * hrg - dsk + onk);
                              handleFieldChange(col.index, String(tot));
                            }}
                            className="px-2.5 py-1 text-xs font-semibold bg-emerald-100 hover:bg-emerald-200 text-emerald-900 rounded-md transition-colors cursor-pointer"
                          >
                            Bayar Lunas (100%)
                          </button>
                        </>
                      )}

                      {val && (
                        <button
                          type="button"
                          onClick={() => handleFieldChange(col.index, '0')}
                          className="px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                        >
                          Set 0
                        </button>
                      )}
                    </div>
                  )}

                  {/* Quick Suggestions for Qty in Tracker Closing */}
                  {sheetTitle === 'Tracker Closing' && col.name === 'Qty (pcs)' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {['1', '100', '150', '200', '300', '350', '500', '800'].map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => handleFieldChange(col.index, q)}
                          className={`px-2 py-0.5 text-xs font-mono rounded-md border transition-colors cursor-pointer ${
                            val === q
                              ? 'bg-emerald-700 text-white border-emerald-700'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {q} pcs
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Suggestions from Existing / Preset Values */}
                  {col.uniqueValues.length > 0 &&
                    col.inferredType !== 'autonumber' &&
                    col.inferredType !== 'invoice' &&
                    col.inferredType !== 'currency' &&
                    col.inferredType !== 'number' &&
                    col.inferredType !== 'date' && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {col.uniqueValues.slice(0, 10).map((suggestion) => {
                          const isSelected = val === suggestion;
                          return (
                            <button
                              key={suggestion}
                              type="button"
                              onClick={() => handleFieldChange(col.index, suggestion)}
                              className={`px-2.5 py-1 text-xs rounded-md border transition-colors truncate max-w-[220px] cursor-pointer ${
                                isSelected
                                  ? 'bg-emerald-700 text-white border-emerald-700 font-semibold'
                                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {suggestion}
                            </button>
                          );
                        })}
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          {/* Blue Formula Columns Live Calculation Box ("Kolom Biru Otomatis") */}
          {columns.some((c) => c.isFormulaColumn) && (
            <div className="p-4 rounded-xl bg-sky-50/70 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-sky-900">
                  <Calculator className="w-4 h-4 text-sky-700" />
                  <span>Pratinjau Kolom Biru (Dihitung Otomatis oleh Rumus Sheet)</span>
                </div>
                <span className="text-[11px] text-sky-700">
                  Rumus asli di Spreadsheet tidak akan tertimpa
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {columns
                  .filter((c) => c.isFormulaColumn)
                  .map((col) => (
                    <div
                      key={col.index}
                      className="p-3 rounded-lg bg-white border border-sky-200/80"
                    >
                      <span className="block text-[11px] text-slate-500">
                        {col.name} (Kolom {col.letter})
                      </span>
                      <span className="text-sm font-mono font-bold text-slate-900 tabular-nums">
                        {liveFormulaPreview[col.index] || 'Otomatis di Sheet'}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <span className="text-xs text-slate-500">
              Akan ditulis ke <strong>Baris #{nextInsertRow1Based}</strong> pada tab{' '}
              <strong>{sheetTitle}</strong>
            </span>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Simpan ke Spreadsheet Serasa Salam</span>
            </button>
          </div>
        </form>
      </div>

      {/* Right 5 Cols: Latest Entries in this Sheet Tab */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              Data Terakhir di {sheetTitle}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Menampilkan {recentRows.length} transaksi terbaru dari spreadsheet Anda
            </p>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Total: {rows.length} baris
          </span>
        </div>

        {recentRows.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Belum ada data pada tab ini.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
            {recentRows.map((row) => (
              <div
                key={row.rowNumber1Based}
                className="p-4 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-mono font-semibold text-slate-500 tabular-nums">
                    Baris #{row.rowNumber1Based}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDuplicateFromRow(row.values)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                      title="Salin nilai baris ini ke form input"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Salin ke Form</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditExistingRow(row.rowNumber1Based, row.values)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {columns.map((col) => {
                    const cellVal = row.values[col.index] || '';
                    if (!cellVal) return null;
                    return (
                      <div key={col.index} className="truncate">
                        <span className="text-slate-400">{col.name}: </span>
                        <span
                          className={`font-medium text-slate-800 ${
                            col.inferredType === 'currency' ||
                            col.inferredType === 'number' ||
                            col.inferredType === 'invoice'
                              ? 'font-mono tabular-nums'
                              : ''
                          }`}
                        >
                          {cellVal}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
