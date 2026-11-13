import React from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Trash2, X } from 'lucide-react';

export interface PendingSheetMutation {
  type: 'append' | 'update' | 'delete' | 'addTab';
  title: string;
  description: string;
  spreadsheetTitle: string;
  sheetTitle: string;
  rowNumber1Based?: number;
  fieldPreview?: { label: string; value: string }[];
  onConfirm: () => Promise<void>;
}

interface ConfirmActionModalProps {
  mutation: PendingSheetMutation | null;
  isSubmitting: boolean;
  onCancel: () => void;
}

export const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({
  mutation,
  isSubmitting,
  onCancel,
}) => {
  if (!mutation) return null;

  const isDelete = mutation.type === 'delete';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            {isDelete ? (
              <div className="w-9 h-9 rounded-lg bg-red-50 border border-red-200 flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
            )}
            <div>
              <h3 id="confirm-modal-title" className="text-base font-bold text-slate-900">
                {mutation.title}
              </h3>
              <p className="text-xs text-slate-500">
                {mutation.spreadsheetTitle} · Tab: {mutation.sheetTitle}
                {mutation.rowNumber1Based ? ` · Baris #${mutation.rowNumber1Based}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition-colors"
            aria-label="Tutup dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
          <p className="text-sm text-slate-600 leading-relaxed">{mutation.description}</p>

          {mutation.fieldPreview && mutation.fieldPreview.length > 0 && (
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 bg-slate-50/60">
              {mutation.fieldPreview.map((item, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2 flex items-baseline justify-between gap-4 text-xs"
                >
                  <span className="font-medium text-slate-500 shrink-0">{item.label}</span>
                  <span className="font-mono text-slate-900 text-right break-all">
                    {item.value ? (
                      item.value
                    ) : (
                      <span className="text-slate-400 italic">(kosong / rumus sheet)</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {isDelete && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Tindakan ini akan menghapus baris #{mutation.rowNumber1Based} secara langsung dari
                file Google Spreadsheet Anda.
              </span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => mutation.onConfirm()}
            disabled={isSubmitting}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
              isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-700 hover:bg-emerald-800'
            }`}
          >
            {isSubmitting ? (
              <span>Menyinkronkan ke Google Sheets...</span>
            ) : isDelete ? (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus dari Spreadsheet</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Konfirmasi & Simpan ke Sheet</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
