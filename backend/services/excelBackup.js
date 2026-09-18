/**
 * excelBackup.js
 * ──────────────────────────────────────────────────────────────────────────────
 * Automatic Excel backup service for customer invoices.
 *
 * Structure:
 *  - One workbook per year: customers-YYYY.xlsx
 *  - One sheet per month inside the workbook: Jan-2026, Feb-2026, …, Dec-2026
 *  - Columns: Date/Time | Invoice No | Customer Name | Phone No | Qty | Amount
 *
 * Dual-write:
 *  - Always writes to the local customer-details/ folder.
 *  - If a OneDrive path is configured in settings, also writes a copy there
 *    and updates last_backup.txt with the current timestamp.
 *
 * Design decisions:
 *  - Works in BOTH Electron (packaged or dev) and plain Node.js environments.
 *  - SQLite save is NEVER blocked. Excel errors are caught and logged.
 * ──────────────────────────────────────────────────────────────────────────────
 */

"use strict";

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const XLSX = require("xlsx");

// ─── 1. Resolve the local base directory ─────────────────────────────────────
function resolveBaseDir() {
  if (process.env.EXCEL_BACKUP_DIR) return process.env.EXCEL_BACKUP_DIR;
  if (process.env.ELECTRON_USER_DATA) return process.env.ELECTRON_USER_DATA;
  try {
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") return app.getPath("userData");
  } catch (_) {}
  return path.join(__dirname, "..", "..");
}

// ─── 2. Local customer-details directory ─────────────────────────────────────
function getCustomerDetailsDir() {
  return path.join(resolveBaseDir(), "customer-details");
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── 3. Read OneDrive path from settings (non-throwing) ──────────────────────
function getOnedrivePath() {
  try {
    const { db } = require("../config/db");
    const settings = db.prepare("SELECT onedrivePath FROM settings ORDER BY id ASC LIMIT 1").get();
    const p = settings && settings.onedrivePath ? settings.onedrivePath.trim() : "";
    return p;
  } catch (_) {
    return "";
  }
}

// ─── 4. Column headers (no TRN) ──────────────────────────────────────────────
const HEADERS = ["Date/Time", "Invoice No", "Customer Name", "Phone No", "Qty", "Amount"];

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                     "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── 5. Derive names from a date ─────────────────────────────────────────────
function getYearlyFileName(dateRef) {
  const d = dateRef ? new Date(dateRef) : new Date();
  return `customers-${d.getFullYear()}.xlsx`;
}

function getSheetName(dateRef) {
  const d = dateRef ? new Date(dateRef) : new Date();
  return `${MONTH_NAMES[d.getMonth()]}-${d.getFullYear()}`;
}

function atomicWriteXLSX(wb, finalPath) {
  const tempPath = finalPath + ".tmp";
  XLSX.writeFile(wb, tempPath, { bookType: "xlsx" });
  try {
    fs.renameSync(tempPath, finalPath);
  } catch (err) {
    // If OneDrive briefly locked the file, attempt to force overwrite
    try {
      fs.copyFileSync(tempPath, finalPath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

function atomicWriteText(content, finalPath) {
  const tempPath = finalPath + ".tmp";
  fs.writeFileSync(tempPath, content, "utf8");
  try {
    fs.renameSync(tempPath, finalPath);
  } catch (err) {
    try {
      fs.copyFileSync(tempPath, finalPath);
    } finally {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    }
  }
}

// ─── 6. Load or create the yearly workbook ───────────────────────────────────
function loadOrCreateWorkbook(filePath) {
  if (fs.existsSync(filePath)) {
    return XLSX.readFile(filePath);
  }
  const wb = XLSX.utils.book_new();
  console.log(`[ExcelBackup] Created new yearly workbook: ${path.basename(filePath)}`);
  return wb;
}

// ─── 7. Ensure a monthly sheet exists inside the workbook ────────────────────
function ensureMonthSheet(wb, sheetName) {
  if (wb.Sheets[sheetName]) return wb.Sheets[sheetName];

  const ws = XLSX.utils.aoa_to_sheet([HEADERS]);
  ws["!cols"] = [
    { wch: 22 }, // Date/Time
    { wch: 18 }, // Invoice No
    { wch: 25 }, // Customer Name
    { wch: 16 }, // Phone No
    { wch: 8  }, // Qty
    { wch: 16 }, // Amount
  ];
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  console.log(`[ExcelBackup] Created sheet: ${sheetName}`);
  return wb.Sheets[sheetName];
}

// ─── 8. Core append + dual-write ─────────────────────────────────────────────
/**
 * @param {object} invoiceData
 * @param {string|Date} invoiceData.date
 * @param {string}      invoiceData.invoiceNumber
 * @param {string}      [invoiceData.customerName]
 * @param {string}      [invoiceData.phoneNumber]
 * @param {number}      [invoiceData.qty]         – total units sold on this invoice
 * @param {number}      invoiceData.grandTotal
 */
function appendInvoiceRow(invoiceData) {
  const {
    date,
    invoiceNumber,
    customerName = "",
    phoneNumber  = "",
    qty          = 0,
    grandTotal   = 0,
  } = invoiceData;

  const dateTime = date
    ? new Date(date).toLocaleString("en-AE", { hour12: true })
    : new Date().toLocaleString("en-AE", { hour12: true });

  const newRow = [
    dateTime,
    invoiceNumber || "",
    customerName  || "",
    phoneNumber   || "",
    Number(qty)   || 0,
    Number(Number(grandTotal).toFixed(2)),
  ];

  const fileName  = getYearlyFileName(date);
  const sheetName = getSheetName(date);

  // ── Write to local customer-details/ dir ──
  const localDir  = ensureDir(getCustomerDetailsDir());
  const localPath = path.join(localDir, fileName);
  const localWb   = loadOrCreateWorkbook(localPath);
  const localWs   = ensureMonthSheet(localWb, sheetName);
  XLSX.utils.sheet_add_aoa(localWs, [newRow], { origin: -1 });
  atomicWriteXLSX(localWb, localPath);
  console.log(`[ExcelBackup] Row appended (local) → ${fileName} [${sheetName}]`);

  // ── Write to OneDrive folder (if configured) ──
  const onedrivePath = getOnedrivePath();
  if (onedrivePath) {
    try {
      ensureDir(onedrivePath);
      const odPath = path.join(onedrivePath, fileName);

      // Load or create an independent copy in the OneDrive folder
      const odWb = loadOrCreateWorkbook(odPath);
      const odWs = ensureMonthSheet(odWb, sheetName);
      XLSX.utils.sheet_add_aoa(odWs, [newRow], { origin: -1 });
      atomicWriteXLSX(odWb, odPath);
      console.log(`[ExcelBackup] Row appended (OneDrive) → ${odPath}`);

      // Update last_backup.txt
      const backupTxtPath = path.join(onedrivePath, "last_backup.txt");
      atomicWriteText(new Date().toISOString(), backupTxtPath);
      console.log(`[ExcelBackup] last_backup.txt updated`);
    } catch (odErr) {
      console.error("[ExcelBackup] OneDrive write failed (local copy still saved):", odErr.message);
    }
  }

  // ── Write to permanent external Documents folder (Fail-safe 3rd copy) ──
  try {
    const externalDocsDir = path.join(os.homedir(), "Documents", "POS Backup");
    ensureDir(externalDocsDir);
    const extPath = path.join(externalDocsDir, fileName);
    const extWb = loadOrCreateWorkbook(extPath);
    const extWs = ensureMonthSheet(extWb, sheetName);
    XLSX.utils.sheet_add_aoa(extWs, [newRow], { origin: -1 });
    atomicWriteXLSX(extWb, extPath);
    console.log(`[ExcelBackup] Row appended (External Docs) → ${extPath}`);
  } catch (extErr) {
    console.error("[ExcelBackup] External Documents write failed:", extErr.message);
  }
}

// ─── 9. Public API ────────────────────────────────────────────────────────────
function backupInvoiceToExcel(invoiceData) {
  try {
    appendInvoiceRow(invoiceData);
  } catch (err) {
    console.error("[ExcelBackup] ERROR — Excel backup failed (SQLite save still succeeded):", err.message);
  }
}

module.exports = {
  backupInvoiceToExcel,
  // Exposed for unit tests / manual use:
  getCustomerDetailsDir,
  getYearlyFileName,
  getSheetName,
};
