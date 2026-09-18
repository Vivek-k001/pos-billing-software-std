const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { db } = require("../config/db");

// ── Settings Endpoints ──

exports.getSettings = async (req, res) => {
  try {
    const settings = db.prepare("SELECT * FROM settings ORDER BY id ASC LIMIT 1").get();
    res.json({
      ...settings,
      autoBackupEnabled: Boolean(settings?.autoBackupEnabled)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.updateSettings = async (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM settings ORDER BY id ASC LIMIT 1").get();
    if (!existing) {
      return res.status(404).json({ message: "Settings not initialized" });
    }

    const {
      companyName,
      address,
      phone,
      trn,
      vatRate,
      autoBackupEnabled,
      autoBackupFrequency,
      onedrivePath
    } = req.body;

    db.prepare(`
      UPDATE settings
      SET companyName = ?, address = ?, phone = ?, trn = ?, vatRate = ?,
          autoBackupEnabled = ?, autoBackupFrequency = ?,
          onedrivePath = ?,
          updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      companyName !== undefined ? companyName : existing.companyName,
      address !== undefined ? address : existing.address,
      phone !== undefined ? phone : existing.phone,
      trn !== undefined ? trn : existing.trn,
      vatRate !== undefined ? Number(vatRate) : existing.vatRate,
      autoBackupEnabled !== undefined ? (autoBackupEnabled ? 1 : 0) : existing.autoBackupEnabled,
      autoBackupFrequency !== undefined ? autoBackupFrequency : existing.autoBackupFrequency,
      onedrivePath !== undefined ? onedrivePath : (existing.onedrivePath || ""),
      existing.id
    );

    const updated = db.prepare("SELECT * FROM settings WHERE id = ?").get(existing.id);
    res.json({
      ...updated,
      autoBackupEnabled: Boolean(updated.autoBackupEnabled)
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Local Backup Endpoints ──

exports.exportLocalBackup = async (req, res) => {
  try {
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `pos-backup-${Date.now()}.db`);

    // Perform an active, non-corrupted hot backup using SQLite
    await db.backup(tempFile);

    res.download(tempFile, "pos-backup.db", (err) => {
      // Clean up the temp file after download completes or aborts
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.restoreLocalBackup = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No database file uploaded" });
    }

    const uploadedPath = req.file.path;
    const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, "..", "database", "pos.db");

    let tempDb;
    try {
      // Validate that the uploaded file is indeed a valid SQLite database
      tempDb = new Database(uploadedPath);
      // Run a simple PRAGMA to test file integrity
      tempDb.pragma("integrity_check");
    } catch (dbErr) {
      if (fs.existsSync(uploadedPath)) {
        fs.unlinkSync(uploadedPath);
      }
      return res.status(400).json({ message: "Invalid SQLite database file. Restoration failed." });
    }

    // Overwrite the active database file safely using better-sqlite3 backup feature
    await tempDb.backup(dbPath);
    tempDb.close();

    // Clean up temporary upload file
    if (fs.existsSync(uploadedPath)) {
      fs.unlinkSync(uploadedPath);
    }

    res.json({ message: "Database successfully restored from local file!" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── OneDrive / Excel Backup Status ──

exports.getExcelBackupStatus = async (req, res) => {
  try {
    const settings = db.prepare("SELECT onedrivePath FROM settings ORDER BY id ASC LIMIT 1").get();
    const onedrivePath = settings && settings.onedrivePath ? settings.onedrivePath.trim() : "";

    if (!onedrivePath) {
      return res.json({ configured: false, lastBackup: null, onedrivePath: "" });
    }

    const backupTxtPath = require("path").join(onedrivePath, "last_backup.txt");
    if (!require("fs").existsSync(backupTxtPath)) {
      return res.json({ configured: true, lastBackup: null, onedrivePath });
    }

    const raw = require("fs").readFileSync(backupTxtPath, "utf8").trim();
    const ts = new Date(raw);
    if (isNaN(ts.getTime())) {
      return res.json({ configured: true, lastBackup: null, onedrivePath });
    }

    res.json({ configured: true, lastBackup: ts.toISOString(), onedrivePath });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
