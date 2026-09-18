const router = require("express").Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
  getSettings,
  updateSettings,
  exportLocalBackup,
  restoreLocalBackup,
  getExcelBackupStatus
} = require("../controllers/backupController");

const { auth, requireRole } = require("../middleware/authMiddleware");

// Ensure upload folder exists in a writable directory
const dbPath = process.env.SQLITE_DB_PATH;
const uploadDir = dbPath
  ? path.join(path.dirname(dbPath), "uploads")
  : path.join(__dirname, "..", "database", "uploads");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir });

// ── Settings Routes ──
router.get("/settings", auth, requireRole("admin"), getSettings);
router.put("/settings", auth, requireRole("admin"), updateSettings);

// ── Local Backup Routes ──
router.get("/local/export", auth, requireRole("admin"), exportLocalBackup);
router.post("/local/restore", auth, requireRole("admin"), upload.single("file"), restoreLocalBackup);

// ── OneDrive / Excel Backup Status ──
router.get("/excel-status", auth, requireRole("admin"), getExcelBackupStatus);

module.exports = router;
