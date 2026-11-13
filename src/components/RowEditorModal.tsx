import React, { useEffect, useState } from 'react';
import { ColumnSchema } from '../services/sheetsApi';
import { Save, X } from 'lucide-react';

interface RowEditorModalProps {
  isOpen: boolean;
  sheetTitle: string;
  rowNumber1Based: number;
  columns: ColumnSchema[];
  initialValues: string[];
  onClose: () => void;
  onSaveRow: (rowNumber1Based: number, updatedValues: string[]) => void;
}

export const RowEditorModal: React.FC<RowEditorModalProps> = ({
  isOpen,
  sheetTitle,
  rowNumber1Based,
  columns,
  initialValues,
  onClose,
  onSaveRow,
}) => {
  const [values, setValues] = useState<string[]>(initialValues);

  useEffect(() => {
    setValues(
      columns.map((_, idx) => (initialValues[idx] !== undefined ? initialValues[idx] : ''))
    );
  }, [initialValues, columns, rowNumber1Based]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveRow(rowNumber1Based, values);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Edit Data Pembukuan — Baris #{rowNumber1Based}
            </h3>
            <p className="text-xs text-slate-500">
              Tab: {sheetTitle} · Kolom biru (rumus otomatis) tidak akan ditimpa
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Tutup modal edit"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 max-h-[68vh] overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-4">
            {columns.map((col, idx) => {
              const val = values[idx] ?? '';
              if (col.isFormulaColumn) {
                return (
                  <div
                    key={col.index}
                    className="space-y-1 p-3 rounded-lg bg-sky-50/60 border border-sky-200"
                  >
                    <label className="block text-xs font-semibold text-sky-900">
                      {col.name}{' '}
                      <span className="font-mono font-normal text-sky-700">
                        ({col.letter} · Rumus Otomatis)
                      </span>
                    </label>
                    <div className="text-sm font-mono font-bold text-slate-800 tabular-nums">
                      {val || 'Dihitung otomatis oleh Sheet'}
                    </div>
                  </div>
                );
              }

              return (
                <div key={col.index} className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    {col.name}{' '}
                    <span className="font-mono font-normal text-amber-700">
                      ({col.letter} · Input)
                    </span>
                  </label>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      const next = [...values];
                      next[idx] = e.target.value;
                      setValues(next);
                    }}
                    className={`w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-emerald-600 ${
                      col.inferredType === 'currency' ||
                      col.inferredType === 'number' ||
                      col.inferredType === 'autonumber' ||
                      col.inferredType === 'invoice'
                        ? 'font-mono tabular-nums'
                        : ''
                    }`}
                  />
                  {col.uniqueValues.length > 0 &&
                    col.inferredType !== 'autonumber' &&
                    col.inferredType !== 'invoice' &&
                    col.inferredType !== 'currency' &&
                    col.inferredType !== 'number' &&
                    col.inferredType !== 'date' && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {col.uniqueValues.slice(0, 6).map((sug) => (
                          <button
                            key={sug}
                            type="button"
                            onClick={() => {
                              const next = [...values];
                              next[idx] = sug;
                              setValues(next);
                            }}
                            className="px-2 py-0.5 text-[11px] bg-slate-100 hover:bg-slate-200 text-slate-700 rounded truncate max-w-[160px] cursor-pointer"
                          >
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Lanjut Simpan Perubahan</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
