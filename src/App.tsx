/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import {
  googleSignIn,
  initAuth,
  logout,
} from './services/auth';
import {
  APPS_SCRIPT_BRIDGE_CODE,
  appendSheetRow,
  DEFAULT_SERASA_SALAM_SPREADSHEET_ID,
  DEFAULT_SERASA_SALAM_URL,
  deleteSheetRow,
  extractSpreadsheetId,
  SheetDataResult,
  updateSheetRow,
} from './services/sheetsApi';
import {
  ClosingOrderItem,
  fetchSerasaWorkspaceBundle,
  SerasaWorkspaceBundle,
} from './services/serasaData';
import { ConfirmActionModal, PendingSheetMutation } from './components/ConfirmActionModal';
import { QuickEntryPanel } from './components/QuickEntryPanel';
import { BookkeepingSummary } from './components/BookkeepingSummary';
import { RowEditorModal } from './components/RowEditorModal';
import { OperationalDashboard } from './components/OperationalDashboard';
import { PosOrderModal } from './components/PosOrderModal';
import { InvoiceStudio } from './components/InvoiceStudio';
import { PricingCalculatorView } from './components/PricingCalculatorView';
import { SERASA_SALAM_LOGO_DATA_URL } from './assets/serasaLogoDataUrl';
import {
  AlertCircle,
  ArrowUpDown,
  Calculator,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileDown,
  FileSpreadsheet,
  HelpCircle,
  LayoutDashboard,
  Link2,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type NavSection =
  | 'dashboard'
  | 'closing'
  | 'invoice'
  | 'piutang'
  | 'calculator'
  | 'connect';

const SCRIPT_URL_STORAGE_KEY = 'serasa_salam_gas_url_v1';
const SHEET_ID_STORAGE_KEY = 'serasa_salam_sheet_id_v1';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Connected Spreadsheet ID (defaults to Serasa Salam sheet)
  const [spreadsheetId, setSpreadsheetId] = useState<string>(() => {
    try {
      return localStorage.getItem(SHEET_ID_STORAGE_KEY) || DEFAULT_SERASA_SALAM_SPREADSHEET_ID;
    } catch {
      return DEFAULT_SERASA_SALAM_SPREADSHEET_ID;
    }
  });
  const [sheetUrlInput, setSheetUrlInput] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(SHEET_ID_STORAGE_KEY);
      return savedId
        ? `https://docs.google.com/spreadsheets/d/${savedId}/edit`
        : DEFAULT_SERASA_SALAM_URL;
    } catch {
      return DEFAULT_SERASA_SALAM_URL;
    }
  });

  // Persisted Google Apps Script Web App URL for 2-way write sync
  const [savedScriptUrl, setSavedScriptUrl] = useState<string>(() => {
    try {
      return localStorage.getItem(SCRIPT_URL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });
  const [scriptUrlInput, setScriptUrlInput] = useState<string>(() => {
    try {
      return localStorage.getItem(SCRIPT_URL_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  // Tracker Closing Workspace Bundle loaded from Google Sheet
  const [bundle, setBundle] = useState<SerasaWorkspaceBundle | null>(null);
  const [isLoadingBundle, setIsLoadingBundle] = useState<boolean>(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Navigation & Modal States
  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [isPosModalOpen, setIsPosModalOpen] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [selectedInvoiceNo, setSelectedInvoiceNo] = useState<string>('');

  // Search & Table states for Tracker Closing view
  const [globalSearch, setGlobalSearch] = useState<string>('');
  const [tableSearch, setTableSearch] = useState<string>('');
  const [reverseOrder, setReverseOrder] = useState<boolean>(true);
  const [subTabMode, setSubTabMode] = useState<'table' | 'entry' | 'summary'>('table');

  // Copy feedback for Apps Script code
  const [copiedScript, setCopiedScript] = useState<boolean>(false);
  const [showOAuthFixGuide, setShowOAuthFixGuide] = useState<boolean>(false);

  // Modals for Edit & Mandatory Confirmation
  const [editingRow, setEditingRow] = useState<{
    sheetTitle: string;
    sheetId: number;
    rowNumber1Based: number;
    values: string[];
    sheetData: SheetDataResult;
  } | null>(null);
  const [pendingMutation, setPendingMutation] = useState<PendingSheetMutation | null>(null);
  const [isMutating, setIsMutating] = useState<boolean>(false);

  // Initialize Firebase Auth listener silently in background
  useEffect(() => {
    const unsubscribe = initAuth(
      (loggedInUser) => setUser(loggedInUser),
      () => setUser(null)
    );
    return () => unsubscribe();
  }, []);

  const loadAllSerasaData = useCallback(
    async (explicitScriptUrl?: string, explicitSheetId?: string) => {
      setIsLoadingBundle(true);
      setApiError(null);
      try {
        const scriptToUse =
          explicitScriptUrl !== undefined ? explicitScriptUrl : savedScriptUrl;
        const sheetToUse =
          explicitSheetId !== undefined ? explicitSheetId : spreadsheetId;
        const data = await fetchSerasaWorkspaceBundle(sheetToUse, scriptToUse);
        setBundle(data);
        if (!selectedInvoiceNo && data.closingOrders.length > 0) {
          setSelectedInvoiceNo(
            data.closingOrders[data.closingOrders.length - 1].invoiceNo
          );
        }
      } catch (err: any) {
        setApiError(
          err?.message || 'Gagal memuat data Tracker Closing dari Google Spreadsheet.'
        );
      } finally {
        setIsLoadingBundle(false);
      }
    },
    [savedScriptUrl, spreadsheetId, selectedInvoiceNo]
  );

  useEffect(() => {
    loadAllSerasaData(savedScriptUrl, spreadsheetId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute badges for sidebar
  const sidebarBadges = useMemo(() => {
    if (!bundle) return { dpCount: 0, totalInvoices: 0 };
    const dpCount = bundle.closingOrders.filter((o) => o.sisa > 0).length;
    const totalInvoices = new Set(
      bundle.closingOrders.map((o) => o.invoiceNo).filter(Boolean)
    ).size;
    return { dpCount, totalInvoices };
  }, [bundle]);

  // Save multi-row or single-row order from POS Modal into Tracker Closing
  const handleSavePosRowsToTrackerClosing = (
    rowsToInsert: { rowNumber1Based: number; values: string[] }[],
    invoiceNo: string
  ) => {
    if (!bundle) return;

    const preview = rowsToInsert.flatMap((row, rIdx) => [
      {
        label: `Item #${rIdx + 1} (Baris #${row.rowNumber1Based})`,
        value: `${row.values[2]} — ${row.values[7]} (${row.values[8]} pcs @ Rp${row.values[9]})`,
      },
      {
        label: `Tagihan & Bayar Item #${rIdx + 1}`,
        value: `Total: ${row.values[13]} | Bayar: Rp${row.values[14]} | Status: ${row.values[17]}`,
      },
    ]);

    setPendingMutation({
      type: 'append',
      title: `Simpan Penjualan Baru (${invoiceNo}) ke Google Sheets`,
      description: `Data penjualan ini (${rowsToInsert.length} baris item) akan langsung ditulis ke tab "Tracker Closing" mulai Baris #${rowsToInsert[0].rowNumber1Based} (kolom rumus otomatis tidak akan ditimpa):`,
      spreadsheetTitle: 'Serasa Salam New Concept x Bisnis',
      sheetTitle: 'Tracker Closing',
      rowNumber1Based: rowsToInsert[0].rowNumber1Based,
      fieldPreview: preview,
      onConfirm: async () => {
        setIsMutating(true);
        try {
          for (const row of rowsToInsert) {
            await appendSheetRow(
              spreadsheetId,
              'Tracker Closing',
              row.values,
              row.rowNumber1Based,
              savedScriptUrl
            );
          }
          setPendingMutation(null);
          setIsPosModalOpen(false);
          setSelectedInvoiceNo(invoiceNo);
          setStatusBanner(
            `Penjualan ${invoiceNo} berhasil disimpan ke tab Tracker Closing di Google Spreadsheet! Silakan unduh PDF Invoice.`
          );
          await loadAllSerasaData(savedScriptUrl, spreadsheetId);
          setActiveNav('invoice');
        } catch (err: any) {
          setApiError(err?.message || 'Gagal menyimpan penjualan ke Google Sheets.');
          setPendingMutation(null);
          if (!savedScriptUrl && !user) {
            setActiveNav('connect');
          }
        } finally {
          setIsMutating(false);
        }
      },
    });
  };

  // Single-row append for Tracker Closing via QuickEntryPanel
  const requestAppendSingleRow = (
    sheetTitle: string,
    sheetData: SheetDataResult,
    values: string[]
  ) => {
    const preview = sheetData.columns.map((col, idx) => ({
      label: `${col.name} (${col.letter})${col.isFormulaColumn ? ' [Rumus Sheet]' : ''}`,
      value: values[idx] || '',
    }));

    setPendingMutation({
      type: 'append',
      title: `Simpan Penjualan ke "${sheetTitle}" (Baris #${sheetData.nextInsertRow1Based})`,
      description: `Data penjualan berikut akan langsung ditulis ke Baris #${sheetData.nextInsertRow1Based} pada tab "${sheetTitle}" di Google Spreadsheet:`,
      spreadsheetTitle: 'Serasa Salam New Concept x Bisnis',
      sheetTitle,
      rowNumber1Based: sheetData.nextInsertRow1Based,
      fieldPreview: preview,
      onConfirm: async () => {
        setIsMutating(true);
        try {
          await appendSheetRow(
            spreadsheetId,
            sheetTitle,
            values,
            sheetData.nextInsertRow1Based,
            savedScriptUrl
          );
          setPendingMutation(null);
          if (values[0]) {
            setSelectedInvoiceNo(values[0]);
          }
          setStatusBanner(
            `Penjualan baru berhasil disimpan ke Baris #${sheetData.nextInsertRow1Based} pada tab "${sheetTitle}".`
          );
          await loadAllSerasaData(savedScriptUrl, spreadsheetId);
          setSubTabMode('table');
        } catch (err: any) {
          setApiError(err?.message || 'Gagal menyimpan baris ke Google Sheets.');
          setPendingMutation(null);
          if (!savedScriptUrl && !user) {
            setActiveNav('connect');
          }
        } finally {
          setIsMutating(false);
        }
      },
    });
  };

  // Update existing row in Tracker Closing
  const requestUpdateExistingRow = (
    sheetTitle: string,
    sheetData: SheetDataResult,
    rowNumber1Based: number,
    updatedValues: string[]
  ) => {
    const preview = sheetData.columns.map((col, idx) => ({
      label: `${col.name} (${col.letter})${col.isFormulaColumn ? ' [Rumus Sheet]' : ''}`,
      value: updatedValues[idx] || '',
    }));

    setPendingMutation({
      type: 'update',
      title: `Konfirmasi Perubahan Baris #${rowNumber1Based} (${sheetTitle})`,
      description: `Perubahan berikut akan disimpan ke Baris #${rowNumber1Based} pada tab "${sheetTitle}" di Google Spreadsheet Anda:`,
      spreadsheetTitle: 'Serasa Salam New Concept x Bisnis',
      sheetTitle,
      rowNumber1Based,
      fieldPreview: preview,
      onConfirm: async () => {
        setIsMutating(true);
        try {
          await updateSheetRow(
            spreadsheetId,
            sheetTitle,
            rowNumber1Based,
            updatedValues,
            savedScriptUrl
          );
          setPendingMutation(null);
          setEditingRow(null);
          setStatusBanner(
            `Baris #${rowNumber1Based} pada tab "${sheetTitle}" berhasil diperbarui.`
          );
          await loadAllSerasaData(savedScriptUrl, spreadsheetId);
        } catch (err: any) {
          setApiError(err?.message || 'Gagal memperbarui baris di Google Sheets.');
          setPendingMutation(null);
          if (!savedScriptUrl && !user) {
            setActiveNav('connect');
          }
        } finally {
          setIsMutating(false);
        }
      },
    });
  };

  // Quick 1-click "Lunasi & Selesai" on an order in Tracker Closing
  const handleQuickMarkPaidAndDone = (order: ClosingOrderItem) => {
    if (!bundle) return;
    const updated = [...order.rawValues];
    updated[14] = String(order.totalTagihan); // Col O: Bayar = Total Tagihan
    updated[17] = 'Selesai'; // Col R: Status = Selesai
    requestUpdateExistingRow(
      'Tracker Closing',
      bundle.closingSheet,
      order.rowNumber1Based,
      updated
    );
  };

  // Delete row
  const requestDeleteExistingRow = (
    sheetTitle: string,
    sheetId: number,
    sheetData: SheetDataResult,
    rowNumber1Based: number,
    rowValues: string[]
  ) => {
    const preview = sheetData.columns
      .map((col, idx) => ({
        label: `${col.name} (${col.letter})`,
        value: rowValues[idx] || '',
      }))
      .filter((item) => item.value !== '');

    setPendingMutation({
      type: 'delete',
      title: `Hapus Data Baris #${rowNumber1Based} dari "${sheetTitle}"?`,
      description: `Apakah Anda yakin ingin menghapus data pada Baris #${rowNumber1Based} dari tab "${sheetTitle}" di Google Spreadsheet?`,
      spreadsheetTitle: 'Serasa Salam New Concept x Bisnis',
      sheetTitle,
      rowNumber1Based,
      fieldPreview: preview,
      onConfirm: async () => {
        setIsMutating(true);
        try {
          await deleteSheetRow(
            spreadsheetId,
            sheetId,
            rowNumber1Based,
            sheetTitle,
            savedScriptUrl
          );
          setPendingMutation(null);
          setStatusBanner(`Baris #${rowNumber1Based} pada tab "${sheetTitle}" telah dihapus.`);
          await loadAllSerasaData(savedScriptUrl, spreadsheetId);
        } catch (err: any) {
          setApiError(err?.message || 'Gagal menghapus baris dari Google Sheets.');
          setPendingMutation(null);
          if (!savedScriptUrl && !user) {
            setActiveNav('connect');
          }
        } finally {
          setIsMutating(false);
        }
      },
    });
  };

  const handleCopyAppsScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_BRIDGE_CODE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      // ignore
    }
  };

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setStatusBanner(`Berhasil masuk sebagai ${result.user.email}`);
      }
    } catch {
      setAuthError(
        'Muncul "Akses diblokir / Error 403"? Gunakan metode Jembatan Google Apps Script di sebelah kiri (Tanpa Login & Bebas Blokir 403) agar aplikasi langsung bisa menyimpan ke Sheet!'
      );
      setShowOAuthFixGuide(true);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  // Render Tracker Closing Table / Form / Summary
  const renderTrackerClosingModule = (
    title: string,
    subtitle: string,
    sheetData: SheetDataResult,
    filterPredicate?: (row: { rowNumber1Based: number; values: string[] }) => boolean
  ) => {
    const sheetTitle = 'Tracker Closing';
    const sheetId = 1373780580;

    const baseRows = filterPredicate
      ? sheetData.rows.filter(filterPredicate)
      : sheetData.rows;

    const q = (tableSearch || globalSearch).toLowerCase().trim();
    const matchedRows = q
      ? baseRows.filter(
          (r) =>
            r.values.some((c) => c.toLowerCase().includes(q)) ||
            String(r.rowNumber1Based).includes(q)
        )
      : [...baseRows];

    if (reverseOrder) {
      matchedRows.reverse();
    }

    const handleDownloadCsv = () => {
      const escapeCsv = (val: string) => `"${String(val ?? '').replace(/"/g, '""')}"`;
      const lines = [
        sheetData.headers.map(escapeCsv).join(','),
        ...matchedRows.map((r) => r.values.map(escapeCsv).join(',')),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Serasa_Salam_Tracker_Closing.csv`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="space-y-5">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Sub-mode switcher */}
            <div className="flex items-center gap-1 p-1 bg-white border border-slate-200 rounded-full shadow-2xs">
              <button
                type="button"
                onClick={() => setSubTabMode('table')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                  subTabMode === 'table'
                    ? 'bg-[#114232] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tabel Data ({matchedRows.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTabMode('entry')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                  subTabMode === 'entry'
                    ? 'bg-[#114232] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                + Input Penjualan
              </button>
              <button
                type="button"
                onClick={() => setSubTabMode('summary')}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-full transition-colors cursor-pointer ${
                  subTabMode === 'summary'
                    ? 'bg-[#114232] text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ringkasan Omzet
              </button>
            </div>

            <button
              type="button"
              onClick={() => setIsPosModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Penjualan (Popup)</span>
            </button>
          </div>
        </div>

        {subTabMode === 'entry' && bundle ? (
          <PosOrderModal
            isOpen={true}
            isInline={true}
            existingOrders={bundle.closingOrders}
            nextInsertRow1Based={sheetData.nextInsertRow1Based}
            onSaveRowsToTrackerClosing={handleSavePosRowsToTrackerClosing}
          />
        ) : subTabMode === 'summary' ? (
          <BookkeepingSummary
            sheetTitle={sheetTitle}
            columns={sheetData.columns}
            rows={baseRows}
          />
        ) : (
          <div className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-2xs">
            {/* Table Toolbar */}
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  placeholder="Cari nama pemesan, nomor invoice, paket, tanggal..."
                  className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReverseOrder((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <ArrowUpDown className="w-3.5 h-3.5" />
                  <span>{reverseOrder ? 'Terbaru di Atas' : 'Urutan Baris Asli'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Unduh CSV</span>
                </button>
              </div>
            </div>

            {/* Table Grid */}
            <div className="overflow-x-auto max-h-[68vh]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-3.5 w-16 font-mono">Baris</th>
                    {sheetData.columns.map((col) => (
                      <th
                        key={col.index}
                        className={`py-3 px-3.5 whitespace-nowrap ${
                          col.inferredType === 'currency' || col.inferredType === 'number'
                            ? 'text-right'
                            : 'text-left'
                        }`}
                      >
                        <span>{col.name}</span>
                      </th>
                    ))}
                    <th className="py-3 px-4 text-right whitespace-nowrap">Invoice & Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {matchedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={sheetData.columns.length + 2}
                        className="py-12 text-center text-slate-400"
                      >
                        Tidak ada baris data yang cocok.
                      </td>
                    </tr>
                  ) : (
                    matchedRows.map((row) => (
                      <tr
                        key={row.rowNumber1Based}
                        className="hover:bg-slate-50/90 transition-colors"
                      >
                        <td className="py-3 px-3.5 font-mono tabular-nums text-slate-400">
                          #{row.rowNumber1Based}
                        </td>
                        {sheetData.columns.map((col) => {
                          const cell = row.values[col.index] || '';
                          const isNumeric =
                            col.inferredType === 'currency' || col.inferredType === 'number';
                          return (
                            <td
                              key={col.index}
                              className={`py-3 px-3.5 max-w-[260px] truncate ${
                                isNumeric
                                  ? 'text-right font-mono tabular-nums font-bold text-slate-900'
                                  : 'text-slate-700 font-medium'
                              }`}
                              title={cell}
                            >
                              {cell}
                            </td>
                          );
                        })}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {row.values[0] && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedInvoiceNo(row.values[0]);
                                  setActiveNav('invoice');
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-lg transition-colors cursor-pointer mr-1"
                                title="Buka & Unduh PDF Invoice"
                              >
                                <FileDown className="w-3 h-3" />
                                <span>PDF Invoice</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setEditingRow({
                                  sheetTitle,
                                  sheetId,
                                  rowNumber1Based: row.rowNumber1Based,
                                  values: row.values,
                                  sheetData,
                                })
                              }
                              className="p-1.5 text-slate-500 hover:text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                              title="Edit baris ini"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestDeleteExistingRow(
                                  sheetTitle,
                                  sheetId,
                                  sheetData,
                                  row.rowNumber1Based,
                                  row.values
                                )
                              }
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Hapus baris ini"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  const navMenuGroups: {
    groupLabel: string;
    items: {
      id: NavSection;
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      badge?: string;
      badgeColor?: string;
      dot?: boolean;
    }[];
  }[] = [
    {
      groupLabel: 'MENU PENJUALAN & INVOICE',
      items: [
        { id: 'dashboard', label: 'Dasbor Penjualan', icon: LayoutDashboard },
        {
          id: 'closing',
          label: 'Tracker Closing (Penjualan)',
          icon: ShoppingBag,
        },
        {
          id: 'invoice',
          label: 'Buat & Unduh PDF Invoice',
          icon: FileDown,
          badge:
            sidebarBadges.totalInvoices > 0
              ? `${sidebarBadges.totalInvoices} Inv`
              : undefined,
          badgeColor: 'bg-emerald-100 text-emerald-800',
        },
        {
          id: 'piutang',
          label: 'Belum Lunas (DP)',
          icon: Users,
          badge: sidebarBadges.dpCount > 0 ? `${sidebarBadges.dpCount} DP` : undefined,
          badgeColor: 'bg-amber-100 text-amber-800',
        },
      ],
    },
    {
      groupLabel: 'PENGATURAN & ALAT BANTU',
      items: [
        { id: 'calculator', label: 'Kalkulator Harga', icon: Calculator },
        {
          id: 'connect',
          label: 'Koneksi Google Sheet',
          icon: Link2,
          dot: Boolean(savedScriptUrl || user),
        },
      ],
    },
  ];

  const activeSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  return (
    <div className="h-screen overflow-hidden flex bg-[#F4F7F5] text-slate-900 print:h-auto print:overflow-visible">
      {/* Left Sidebar (Desktop Fixed Stationary + Mobile Drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-[264px] h-screen shrink-0 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 print:hidden ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Top Brand + Nav List */}
        <div className="flex-1 overflow-y-auto">
          <div className="h-16 px-6 flex items-center justify-between border-b border-slate-100">
            <button
              type="button"
              onClick={() => {
                setActiveNav('dashboard');
                setIsMobileSidebarOpen(false);
              }}
              className="flex items-center cursor-pointer"
            >
              <img
                src={SERASA_SALAM_LOGO_DATA_URL}
                alt="Serasa Salam Undangan Lembang"
                className="h-9 w-auto object-contain"
              />
            </button>
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(false)}
              className="lg:hidden p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-4 space-y-6">
            {navMenuGroups.map((group) => (
              <div key={group.groupLabel} className="space-y-1">
                <div className="px-3 pb-1.5 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
                  {group.groupLabel}
                </div>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveNav(item.id);
                        setSubTabMode('table');
                        setTableSearch('');
                        setIsMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#114232] text-white shadow-xs'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-emerald-300' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>

                      {item.badge && (
                        <span
                          className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full shrink-0 ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : item.badgeColor || 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Sidebar Cards */}
        <div className="p-4 space-y-3 border-t border-slate-100">
          <div className="p-4 rounded-2xl bg-[#114232] text-white space-y-2">
            <div className="flex items-center gap-2 text-xs font-extrabold">
              <FileSpreadsheet className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>Tracker Closing Sync</span>
            </div>
            <p className="text-[11px] text-emerald-100/80 leading-relaxed">
              {savedScriptUrl || user
                ? 'Sinkronisasi 2-Arah Aktif. Input penjualan langsung tersimpan ke Sheet.'
                : 'Mode Baca Aktif. Klik Koneksi Sheet untuk mengaktifkan simpan otomatis.'}
            </p>
            <a
              href={activeSpreadsheetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-white underline pt-0.5"
            >
              <span>Buka Google Sheet</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#114232] text-white font-extrabold text-xs flex items-center justify-center shrink-0">
                R
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-slate-900 truncate">
                  {user?.displayName || 'Rinaldy Harisma'}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  Owner & Admin
                </div>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area (Stationary Header + Independently Scrollable Viewport) */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0 print:h-auto print:overflow-visible">
        {/* Stationary Top Bar: Never scrolls with content */}
        <header className="shrink-0 z-30 h-16 bg-white border-b border-slate-200/80 px-4 sm:px-8 flex items-center justify-between gap-4 print:hidden">
          {/* Left: Mobile drawer button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="lg:hidden text-sm font-extrabold text-slate-900">
              Serasa Salam
            </span>
          </div>

          {/* Center: Global Search Input */}
          <div className="flex-1 max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  if (activeNav === 'dashboard' && e.target.value.trim()) {
                    setActiveNav('closing');
                  }
                }}
                placeholder="Cari nomor invoice, nama pemesan, paket undangan..."
                className="w-full pl-10 pr-12 py-2 text-xs bg-slate-100/80 border border-slate-200/80 rounded-full text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-emerald-700"
              />
              <span className="hidden sm:inline-block text-[10px] font-mono text-slate-400 bg-white px-1.5 py-0.5 rounded border border-slate-200 absolute right-3 top-1/2 -translate-y-1/2">
                ⌘K
              </span>
            </div>
          </div>

          {/* Right: Sync Button + Primary "+ Input Penjualan" Button + PDF Invoice Button */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => loadAllSerasaData(savedScriptUrl, spreadsheetId)}
              disabled={isLoadingBundle}
              title="Sinkronkan ulang dengan Google Spreadsheet"
              className="p-2 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isLoadingBundle ? 'animate-spin text-emerald-700' : ''}`}
              />
            </button>

            <button
              type="button"
              onClick={() => setActiveNav('invoice')}
              className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileDown className="w-3.5 h-3.5 text-[#114232]" />
              <span>Unduh PDF Invoice</span>
            </button>

            <button
              type="button"
              onClick={() => setIsPosModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-extrabold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full shadow-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Input Penjualan</span>
            </button>
          </div>
        </header>

        {/* Independently Scrollable Viewport Body */}
        <main
          className={`flex-1 overflow-y-auto print:overflow-visible ${
            activeNav === 'invoice' ? 'lg:overflow-hidden' : ''
          }`}
        >
          <div className="max-w-[1380px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* Status & Error Banners */}
          {statusBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-900">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{statusBanner}</span>
              </div>
              <button
                type="button"
                onClick={() => setStatusBanner(null)}
                className="text-emerald-700 hover:underline shrink-0"
              >
                Tutup
              </button>
            </div>
          )}

          {apiError && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-900">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{apiError}</span>
              </div>
              <button
                type="button"
                onClick={() => setApiError(null)}
                className="text-rose-700 hover:underline shrink-0"
              >
                Tutup
              </button>
            </div>
          )}

          {/* Prompt bar if 2-way write script URL is not configured yet */}
          {!savedScriptUrl && !user && activeNav !== 'connect' && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 rounded-2xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950">
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4 text-amber-700 shrink-0" />
                <span>
                  Data <strong>Tracker Closing</strong> tampil secara real-time dari Google
                  Spreadsheet. Agar saat Anda input penjualan langsung tertulis ke Sheet tanpa
                  blokir 403, hubungkan URL Web App Apps Script.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveNav('connect')}
                className="px-3.5 py-1.5 rounded-full bg-amber-900 text-white font-bold text-xs hover:bg-amber-950 transition-colors shrink-0 cursor-pointer"
              >
                Aktifkan Simpan ke Sheet &rarr;
              </button>
            </div>
          )}

          {isLoadingBundle && !bundle ? (
            <div className="space-y-5">
              <div className="h-8 w-64 bg-slate-200 rounded-xl animate-pulse" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className="h-40 bg-white border border-slate-200 rounded-3xl p-6 animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : bundle ? (
            <>
              {/* 1. DASBOR PENJUALAN */}
              {activeNav === 'dashboard' && (
                <OperationalDashboard
                  orders={bundle.closingOrders}
                  onOpenPosModal={() => setIsPosModalOpen(true)}
                  onNavigate={(v) => {
                    setActiveNav(v as NavSection);
                    setSubTabMode('table');
                  }}
                  onSelectInvoice={(inv) => setSelectedInvoiceNo(inv)}
                />
              )}

              {/* 2. PENJUALAN (Tracker Closing) */}
              {activeNav === 'closing' &&
                renderTrackerClosingModule(
                  'Data & Input Penjualan (Tracker Closing)',
                  'Seluruh penjualan yang diinput dari aplikasi ini langsung masuk ke tab Tracker Closing di Google Spreadsheet.',
                  bundle.closingSheet
                )}

              {/* 3. BUAT & UNDUH PDF INVOICE */}
              {activeNav === 'invoice' && (
                <InvoiceStudio
                  orders={bundle.closingOrders}
                  selectedInvoiceNo={selectedInvoiceNo}
                  onSelectInvoiceNo={setSelectedInvoiceNo}
                  onQuickMarkPaidAndDone={handleQuickMarkPaidAndDone}
                />
              )}

              {/* 4. BELUM LUNAS / DP (Filtered Tracker Closing where Sisa > 0) */}
              {activeNav === 'piutang' &&
                renderTrackerClosingModule(
                  'Daftar Pesanan Belum Lunas (DP)',
                  'Filter khusus pesanan di Tracker Closing yang masih memiliki Sisa Tagihan > Rp 0 untuk memudahkan pelunasan & pengiriman Invoice PDF.',
                  bundle.closingSheet,
                  (row) => {
                    const sisaStr = (row.values[15] || '').replace(/[^\d-]/g, '');
                    return Number(sisaStr) > 0;
                  }
                )}

              {/* 5. KALKULATOR HARGA */}
              {activeNav === 'calculator' && (
                <PricingCalculatorView
                  onOpenPosWithPreset={() => setIsPosModalOpen(true)}
                />
              )}

              {/* 6. KONEKSI GOOGLE SHEET (Spreadsheet Link + 2-Way Apps Script Bridge Setup) */}
              {activeNav === 'connect' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  <div className="lg:col-span-7 space-y-6">
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-5 shadow-2xs">
                      <div>
                        <div className="text-xs font-extrabold text-emerald-700 mb-1">
                          Koneksi Langsung ke Tab &ldquo;Tracker Closing&rdquo;
                        </div>
                        <h1 className="text-lg font-extrabold text-slate-900">
                          Pengaturan Google Spreadsheet & Sinkronisasi 2-Arah
                        </h1>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          Pastikan link Google Spreadsheet dan{' '}
                          <strong>URL Web App Google Apps Script</strong> terpasang di bawah ini agar
                          setiap penjualan yang diinput dari aplikasi langsung tertulis ke baris
                          berikutnya di tab <strong>Tracker Closing</strong>:
                        </p>
                      </div>

                      <form
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const extractedId =
                            extractSpreadsheetId(sheetUrlInput) ||
                            DEFAULT_SERASA_SALAM_SPREADSHEET_ID;
                          const cleanScript = scriptUrlInput.trim();

                          setSpreadsheetId(extractedId);
                          setSavedScriptUrl(cleanScript);
                          try {
                            localStorage.setItem(SHEET_ID_STORAGE_KEY, extractedId);
                            localStorage.setItem(SCRIPT_URL_STORAGE_KEY, cleanScript);
                          } catch {
                            // ignore
                          }
                          await loadAllSerasaData(cleanScript, extractedId);
                          setStatusBanner(
                            cleanScript
                              ? 'Google Spreadsheet & Jembatan Apps Script berhasil dihubungkan! Input penjualan sekarang langsung tersimpan ke Sheet.'
                              : 'Link Google Spreadsheet berhasil diperbarui.'
                          );
                          setActiveNav('dashboard');
                        }}
                        className="space-y-4"
                      >
                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            Link Google Spreadsheet (Memiliki Tab <code>Tracker Closing</code>)
                          </label>
                          <input
                            type="text"
                            value={sheetUrlInput}
                            onChange={(e) => setSheetUrlInput(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI/edit"
                            className="w-full px-4 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-800 mb-1.5">
                            URL Web App Google Apps Script (Berakhiran <code>/exec</code> untuk
                            Simpan Otomatis Tanpa Blokir 403)
                          </label>
                          <input
                            type="text"
                            value={scriptUrlInput}
                            onChange={(e) => setScriptUrlInput(e.target.value)}
                            placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                            className="w-full px-4 py-2.5 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-700"
                          />
                        </div>

                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="submit"
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full transition-colors cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Simpan & Hubungkan Spreadsheet</span>
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xs">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-[#114232] flex items-center justify-center shrink-0">
                            <Code2 className="w-4 h-4" />
                          </div>
                          <div>
                            <h2 className="text-sm font-extrabold text-slate-900">
                              Panduan 1 Menit Pasang Kode Apps Script di Sheet Anda
                            </h2>
                            <p className="text-xs text-slate-500">
                              Agar aplikasi bisa menulis langsung ke Sheet tanpa blokir Google 403
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={handleCopyAppsScript}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#114232] hover:bg-[#0c3124] rounded-full transition-colors cursor-pointer"
                        >
                          {copiedScript ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-300" />
                              <span>Kode Disalin!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Salin Kode Apps Script</span>
                            </>
                          )}
                        </button>
                      </div>

                      <ol className="text-xs text-slate-700 space-y-2 list-decimal list-inside bg-slate-50 p-4 rounded-2xl border border-slate-200 leading-relaxed">
                        <li>
                          Buka{' '}
                          <a
                            href={activeSpreadsheetUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-800 font-bold underline"
                          >
                            Google Spreadsheet Serasa Salam Anda
                          </a>
                          , lalu klik menu di bagian atas: <strong>Ekstensi (Extensions)</strong>{' '}
                          &rarr; <strong>Apps Script</strong>.
                        </li>
                        <li>
                          Hapus kode pendek di dalam editor <code>Code.gs</code>, klik tombol{' '}
                          <strong>Salin Kode Apps Script</strong> di atas dan tempel (
                          <em>Paste</em>), lalu tekan <strong>Ctrl + S</strong> (Simpan).
                        </li>
                        <li>
                          Klik tombol biru <strong>Terapkan (Deploy)</strong> di kanan atas &rarr;
                          pilih <strong>Deployment baru (New deployment)</strong>.
                        </li>
                        <li>
                          Pilih jenis: <strong>Aplikasi web (Web app)</strong>. Pada bagian{' '}
                          <em>Siapa yang memiliki akses (Who has access)</em>, pilih{' '}
                          <strong>Siapa saja (Anyone)</strong>, lalu klik <strong>Terapkan</strong>.
                        </li>
                        <li>
                          Salin <strong>URL Aplikasi Web</strong> yang muncul (berakhiran{' '}
                          <code>/exec</code>) lalu tempel ke kolom di atas!
                        </li>
                      </ol>
                    </div>
                  </div>

                  <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-6 space-y-4 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-extrabold text-slate-900">
                          Opsi Alternatif: Login Google (OAuth)
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowOAuthFixGuide((v) => !v)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline cursor-pointer"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>Cara Buka Blokir 403</span>
                        </button>
                      </div>

                      {user ? (
                        <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 truncate">
                              {user.displayName || user.email}
                            </p>
                            <p className="text-xs text-slate-500 truncate">{user.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={handleLogout}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-rose-600 bg-white border border-slate-200 rounded-xl"
                          >
                            <LogOut className="w-3 h-3" />
                            <span>Keluar</span>
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <button
                            type="button"
                            onClick={handleLogin}
                            disabled={isLoggingIn}
                            className="gsi-material-button"
                          >
                            <div className="gsi-material-button-state"></div>
                            <div className="gsi-material-button-content-wrapper">
                              <div className="gsi-material-button-icon">
                                <svg
                                  version="1.1"
                                  xmlns="http://www.w3.org/2000/svg"
                                  viewBox="0 0 48 48"
                                  style={{ display: 'block' }}
                                >
                                  <path
                                    fill="#EA4335"
                                    d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                                  ></path>
                                  <path
                                    fill="#4285F4"
                                    d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                                  ></path>
                                  <path
                                    fill="#FBBC05"
                                    d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                                  ></path>
                                  <path
                                    fill="#34A853"
                                    d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                                  ></path>
                                  <path fill="none" d="M0 0h48v48H0z"></path>
                                </svg>
                              </div>
                              <span className="gsi-material-button-contents">
                                {isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
                              </span>
                              <span style={{ display: 'none' }}>Sign in with Google</span>
                            </div>
                          </button>

                          {authError && (
                            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
                              {authError}
                            </div>
                          )}
                        </div>
                      )}

                      {showOAuthFixGuide && (
                        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-2 leading-relaxed">
                          <p className="font-bold text-slate-900">
                            Cara Membuka Blokir Error 403 di Google Cloud Console:
                          </p>
                          <ol className="list-decimal list-inside space-y-1">
                            <li>
                              Buka{' '}
                              <a
                                href="https://console.cloud.google.com/auth/audience?project=gen-lang-client-0921032755"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-700 font-bold underline"
                              >
                                Google Cloud Console &rarr; Audience
                              </a>
                              .
                            </li>
                            <li>
                              Klik <strong>+ Add Users</strong> pada bagian{' '}
                              <strong>Test users</strong>.
                            </li>
                            <li>
                              Ketik <code>rinaldiharisma28@gmail.com</code> lalu klik{' '}
                              <strong>Save</strong>.
                            </li>
                          </ol>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : null}
          </div>
        </main>
      </div>

      {/* Full POS & Input Penjualan Modal */}
      {bundle && (
        <PosOrderModal
          isOpen={isPosModalOpen}
          existingOrders={bundle.closingOrders}
          nextInsertRow1Based={bundle.closingSheet.nextInsertRow1Based}
          onClose={() => setIsPosModalOpen(false)}
          onSaveRowsToTrackerClosing={handleSavePosRowsToTrackerClosing}
        />
      )}

      {/* Row Editor Modal */}
      {editingRow && (
        <RowEditorModal
          isOpen={true}
          sheetTitle={editingRow.sheetTitle}
          rowNumber1Based={editingRow.rowNumber1Based}
          columns={editingRow.sheetData.columns}
          initialValues={editingRow.values}
          onClose={() => setEditingRow(null)}
          onSaveRow={(rowNum, updatedVals) =>
            requestUpdateExistingRow(
              editingRow.sheetTitle,
              editingRow.sheetData,
              rowNum,
              updatedVals
            )
          }
        />
      )}

      {/* Mandatory Confirmation Dialog for all Google Sheets mutations */}
      <ConfirmActionModal
        mutation={pendingMutation}
        isSubmitting={isMutating}
        onCancel={() => {
          if (!isMutating) setPendingMutation(null);
        }}
      />
    </div>
  );
}
