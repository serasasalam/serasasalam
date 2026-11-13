import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Known tab GIDs for Serasa Salam New Concept x Bisnis (fallback if HTML regex misses any)
const SERASA_SALAM_KNOWN_TABS = [
  { sheetId: 1373780580, title: 'Tracker Closing', index: 0, rowCount: 1001, columnCount: 21 },
  { sheetId: 8545078, title: 'PO Ganci', index: 1, rowCount: 500, columnCount: 10 },
  { sheetId: 1455798078, title: 'Pemasukan Diluar Undangan', index: 2, rowCount: 500, columnCount: 4 },
  { sheetId: 1848979592, title: 'Pengeluaran', index: 3, rowCount: 500, columnCount: 4 },
  { sheetId: 967107765, title: 'Tracker Mitra', index: 4, rowCount: 200, columnCount: 14 },
  { sheetId: 1404271782, title: 'Dashboard', index: 5, rowCount: 100, columnCount: 12 },
  { sheetId: 1353473821, title: 'INVOICE', index: 6, rowCount: 100, columnCount: 10 },
  { sheetId: 1898966155, title: 'Paket Harga', index: 7, rowCount: 100, columnCount: 6 },
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '5mb' }));

  /**
   * Proxy to Google Apps Script Web App URL (Bypasses browser CORS & 403 OAuth verification block)
   */
  app.post('/api/gas-proxy', async (req, res) => {
    try {
      const { scriptUrl, payload } = req.body || {};
      if (
        !scriptUrl ||
        typeof scriptUrl !== 'string' ||
        !scriptUrl.startsWith('https://script.google.com/')
      ) {
        return res.status(400).json({
          error:
            'URL Web App Google Apps Script tidak valid. Pastikan diawali dengan https://script.google.com/macros/s/.../exec',
        });
      }

      const response = await fetch(scriptUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        redirect: 'follow',
        body: JSON.stringify(payload || {}),
      });

      const text = await response.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        return res.status(502).json({
          error:
            'Respons dari Google Apps Script bukan format JSON. Pastikan saat Deploy Web App, bagian "Siapa yang memiliki akses (Who has access)" diatur ke "Siapa saja (Anyone)".',
          rawPreview: text.slice(0, 300),
        });
      }

      if (data && data.ok === false) {
        return res
          .status(400)
          .json({ error: data.error || 'Terjadi kesalahan pada Google Apps Script.' });
      }

      return res.json(data);
    } catch (err) {
      return res.status(500).json({
        error:
          err instanceof Error
            ? err.message
            : 'Gagal menghubungi Google Apps Script Web App.',
      });
    }
  });

  /**
   * Direct Public/Shared Link Reader for Google Spreadsheets (No OAuth required)
   */
  app.get('/api/public-sheet/meta', async (req, res) => {
    try {
      const spreadsheetId = String(req.query.spreadsheetId || '').trim();
      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID diperlukan.' });
      }

      const pageUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
        spreadsheetId
      )}/edit`;
      const pageRes = await fetch(pageUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        },
        redirect: 'follow',
      });

      const html = await pageRes.text();

      if (html.includes('ServiceLogin') || html.includes('accounts.google.com/v3/signin')) {
        return res.status(403).json({
          error:
            'File Spreadsheet ini masih bersifat Privat. Ubah akses bagikan (Share) di Google Sheets menjadi "Siapa saja yang memiliki link" ATAU gunakan metode Google Apps Script.',
        });
      }

      let title = 'Serasa Salam New Concept x Bisnis';
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        title = titleMatch[1]
          .replace(/\s*-\s*Google\s*(Sheets|Spreadsheet|Drive)\s*$/i, '')
          .trim();
      }

      const extractedSheets = [];
      const tabRegex = /\[(\d+),\d+,\\?"(\d+)\\?",\[\{\\?"1\\?":\[\[0,0,\\?"([^"\\]+)\\?"/g;
      let match;
      const seenTitles = new Set();
      while ((match = tabRegex.exec(html)) !== null) {
        const sheetId = Number(match[2]);
        const tabTitle = match[3];
        if (tabTitle && !seenTitles.has(tabTitle)) {
          seenTitles.add(tabTitle);
          extractedSheets.push({
            sheetId: Number.isFinite(sheetId) ? sheetId : extractedSheets.length,
            title: tabTitle,
            index: extractedSheets.length,
            rowCount: 1000,
            columnCount: 26,
          });
        }
      }

      // If this is the Serasa Salam spreadsheet, prioritize the operational bookkeeping tabs first!
      let sheets = extractedSheets;
      if (spreadsheetId === '1YYMnbbVAfEPGcDlizW93LdqqS6wcalnKn_tJJeLd-nI') {
        const priorityOrder = [
          'Tracker Closing',
          'PO Ganci',
          'Pemasukan Diluar Undangan',
          'Pengeluaran',
          'Tracker Mitra',
          'Paket Harga',
          'Dashboard',
          'INVOICE',
        ];
        const sourceList = extractedSheets.length > 0 ? extractedSheets : SERASA_SALAM_KNOWN_TABS;
        sheets = [...sourceList].sort((a, b) => {
          const idxA = priorityOrder.indexOf(a.title);
          const idxB = priorityOrder.indexOf(b.title);
          if (idxA !== -1 && idxB !== -1) return idxA - idxB;
          if (idxA !== -1) return -1;
          if (idxB !== -1) return 1;
          return a.index - b.index;
        });
      } else if (sheets.length === 0) {
        sheets = [
          {
            sheetId: 0,
            title: 'Sheet1',
            index: 0,
            rowCount: 1000,
            columnCount: 26,
          },
        ];
      }

      return res.json({
        spreadsheetId,
        title,
        locale: 'id_ID',
        timeZone: 'Asia/Jakarta',
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        sheets,
      });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membaca metadata spreadsheet.',
      });
    }
  });

  app.get('/api/public-sheet/values', async (req, res) => {
    try {
      const spreadsheetId = String(req.query.spreadsheetId || '').trim();
      const sheetTitle = String(req.query.sheetTitle || '').trim();
      const sheetIdParam = req.query.sheetId !== undefined ? String(req.query.sheetId) : '';

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID diperlukan.' });
      }

      // Resolve GID from sheetId query param or known Serasa Salam tabs
      let gid = sheetIdParam;
      if (!gid && sheetTitle) {
        const known = SERASA_SALAM_KNOWN_TABS.find(
          (t) => t.title.toLowerCase() === sheetTitle.toLowerCase()
        );
        if (known) gid = String(known.sheetId);
      }

      // Use /export?format=csv&gid=... for exact unmerged row-by-row export
      let exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
        spreadsheetId
      )}/export?format=csv${gid ? `&gid=${encodeURIComponent(gid)}` : ''}`;

      let csvRes = await fetch(exportUrl, { redirect: 'follow' });
      if (!csvRes.ok && sheetTitle) {
        // Fallback to gviz with headers=0
        exportUrl = `https://docs.google.com/spreadsheets/d/${encodeURIComponent(
          spreadsheetId
        )}/gviz/tq?tqx=out:csv&headers=0&sheet=${encodeURIComponent(sheetTitle)}`;
        csvRes = await fetch(exportUrl, { redirect: 'follow' });
      }

      if (!csvRes.ok) {
        return res.status(csvRes.status).json({
          error: 'Gagal mengambil data dari tab spreadsheet.',
        });
      }

      const csvText = await csvRes.text();
      if (csvText.trim().startsWith('<!DOCTYPE html>') || csvText.includes('accounts.google.com')) {
        return res.status(403).json({
          error:
            'Spreadsheet tidak dapat diakses publik. Gunakan metode Google Apps Script atau ubah izin Share ke "Siapa saja yang memiliki link".',
        });
      }

      const rows = parseCsvTo2DArray(csvText);
      return res.json({ values: rows });
    } catch (err) {
      return res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal membaca isi spreadsheet.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

function parseCsvTo2DArray(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current);
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current);
        result.push(row);
        row = [];
        current = '';
        i++;
      } else if (ch === '\n') {
        row.push(current);
        result.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  if (current.length > 0 || row.length > 0) {
    row.push(current);
    result.push(row);
  }

  return result;
}

startServer();
