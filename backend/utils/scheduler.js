const { db } = require("../config/db");
const fs = require("fs");
const path = require("path");
const os = require("os");

let schedulerInterval = null;

const runAutoBackup = async () => {
  try {
    const dbPath = db.name;
    if (!dbPath || !fs.existsSync(dbPath)) return;

    // Use atomic write function to prevent locking issues
    const safeCopy = (source, targetDir, filename) => {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
      const targetPath = path.join(targetDir, filename);
      const tempPath = targetPath + ".tmp";
      fs.copyFileSync(source, tempPath);
      try {
        fs.renameSync(tempPath, targetPath);
      } catch (err) {
        try {
          fs.copyFileSync(tempPath, targetPath);
        } finally {
          if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        }
      }
    };

    const backupFileName = `pos-database-backup.db`;

    // 1. Backup to Documents folder (Fail-safe)
    const docsDir = path.join(os.homedir(), "Documents", "POS Backup");
    safeCopy(dbPath, docsDir, backupFileName);
    console.log(`[Scheduler] Database backed up to Documents folder`);

    // 2. Backup to OneDrive folder (If configured)
    try {
      const settings = db.prepare("SELECT onedrivePath FROM settings ORDER BY id ASC LIMIT 1").get();
      const onedrivePath = settings && settings.onedrivePath ? settings.onedrivePath.trim() : "";
      if (onedrivePath) {
        safeCopy(dbPath, onedrivePath, backupFileName);
        console.log(`[Scheduler] Database backed up to OneDrive folder`);
      }
    } catch (odErr) {
      console.log(`[Scheduler] Skipping OneDrive backup:`, odErr.message);
    }

  } catch (err) {
    console.error("[Scheduler] Auto-backup failed:", err.message);
  }
};

const startScheduler = () => {
  if (schedulerInterval) return;

  // Run on startup (with 10 seconds delay so that server can boot comfortably)
  setTimeout(runAutoBackup, 10000);

  // Check hourly
  schedulerInterval = setInterval(runAutoBackup, 1000 * 60 * 60);
  console.log("Auto-backup background scheduler initialized.");
};

const stopScheduler = () => {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
    console.log("Auto-backup background scheduler stopped.");
  }
};

module.exports = {
  startScheduler,
  stopScheduler,
  runAutoBackup
};
