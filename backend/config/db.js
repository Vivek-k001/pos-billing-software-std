const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");
const { hashPassword } = require("../utils/auth");

// Resolve the database file path
// Use custom SQLITE_DB_PATH (e.g. set by Electron in AppData folder), otherwise fallback to local folder
let dbPath = process.env.SQLITE_DB_PATH;
if (!dbPath) {
  const dbDir = path.join(__dirname, "..", "database");
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  dbPath = path.join(dbDir, "pos.db");
} else {
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

console.log(`Connecting to SQLite database at: ${dbPath}`);
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Enable foreign keys
db.pragma("foreign_keys = ON");

// Initialize Schema
const initSchema = () => {
  // Migration for changing check constraint from 'owner' to 'admin'
  try {
    const userTableDef = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").get();
    if (userTableDef && userTableDef.sql && userTableDef.sql.includes("'owner'")) {
      console.log("[DB] Migrating table 'users' CHECK constraint from 'owner' to 'admin'...");

      const runMigration = db.transaction(() => {
        db.prepare("ALTER TABLE users RENAME TO _users_old").run();

        db.prepare(`
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            role TEXT CHECK(role IN ('admin', 'staff')) DEFAULT 'staff',
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `).run();

        db.prepare(`
          INSERT INTO users (id, name, email, password, role, createdAt, updatedAt)
          SELECT id, name,
                 CASE WHEN email = 'owner@pos.com' THEN 'admin@pos.com' ELSE email END,
                 password,
                 CASE WHEN role = 'owner' THEN 'admin' ELSE role END,
                 createdAt, updatedAt
          FROM _users_old
        `).run();

        db.prepare("DROP TABLE _users_old").run();
      });

      runMigration();
      console.log("[DB] Table 'users' CHECK constraint migration complete.");
    }
  } catch (err) {
    console.error("[DB] Table 'users' CHECK constraint migration failed:", err.message);
  }

  // 1. Users Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT CHECK(role IN ('admin', 'staff')) DEFAULT 'staff',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 2. Products Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sku TEXT DEFAULT '',
      price REAL NOT NULL,
      stock INTEGER DEFAULT 0,
      maxStock INTEGER DEFAULT 0,
      category TEXT DEFAULT 'General',
      vat REAL DEFAULT 5,
      serialNumber TEXT DEFAULT '',
      warrantyMonths INTEGER DEFAULT 0,
      vatApplicable INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Add maxStock column if it doesn't exist yet (migration for existing DBs)
  try {
    db.prepare("ALTER TABLE products ADD COLUMN maxStock INTEGER DEFAULT 0").run();
    console.log("[DB] Added maxStock column to products");
  } catch (_) {
    // Column already exists — ignore
  }

  // 3. Customers Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      location TEXT DEFAULT '',
      contact TEXT DEFAULT '',
      trn TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 4. Invoices Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceNumber TEXT NOT NULL UNIQUE,
      date TEXT NOT NULL,
      customerName TEXT,
      customerLocation TEXT,
      customerContact TEXT,
      customerTrn TEXT,
      subtotal REAL,
      vatTotal REAL,
      discount REAL,
      discountType TEXT DEFAULT 'flat',
      grandTotal REAL,
      paymentMethod TEXT,
      status TEXT DEFAULT 'Active',
      detailsBrandName TEXT,
      detailsModel TEXT,
      detailsTotalCntr TEXT,
      detailsContract TEXT,
      detailsDnNo TEXT,
      detailsDnDate TEXT,
      detailsSrNo TEXT,
      detailsSrDate TEXT,
      detailsLpoNo TEXT,
      detailsLpoDate TEXT,
      detailsNote TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // 5. Invoice Items Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoiceId INTEGER NOT NULL,
      productId TEXT,
      name TEXT,
      qty INTEGER,
      rate REAL,
      serialNumber TEXT,
      warrantyMonths INTEGER,
      warrantyUntil TEXT,
      vat REAL,
      total REAL,
      FOREIGN KEY (invoiceId) REFERENCES invoices (id) ON DELETE CASCADE
    )
  `).run();

  // 6. Settings Table
  db.prepare(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      companyName TEXT DEFAULT 'IMAGE OFFICE',
      address TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      trn TEXT DEFAULT '100335760300003',
      vatRate REAL DEFAULT 5,
      googleClientId TEXT DEFAULT '',
      googleClientSecret TEXT DEFAULT '',
      googleRefreshToken TEXT DEFAULT '',
      autoBackupEnabled INTEGER DEFAULT 0,
      autoBackupFrequency TEXT DEFAULT 'daily',
      onedrivePath TEXT DEFAULT '',
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run();

  // Add onedrivePath column if it doesn't exist yet (migration for existing DBs)
  try {
    db.prepare("ALTER TABLE settings ADD COLUMN onedrivePath TEXT DEFAULT ''").run();
    console.log("[DB] Added onedrivePath column to settings");
  } catch (_) {
    // Column already exists — ignore
  }

  // ── Migrate existing 'owner' role rows → 'admin' (run before CHECK constraint applies) ──
  // SQLite CHECK constraints are not enforced on existing data during ALTER TABLE,
  // so we migrate the data values here at every startup (safe to run multiple times).
  try {
    const ownerCount = db.prepare("SELECT count(*) as count FROM users WHERE role = 'owner'").get();
    if (ownerCount.count > 0) {
      db.prepare("UPDATE users SET role = 'admin', email = CASE WHEN email = 'owner@pos.com' THEN 'admin@pos.com' ELSE email END WHERE role = 'owner'").run();
      console.log(`[DB] Migrated ${ownerCount.count} user(s) from role 'owner' to 'admin'`);
    }
  } catch (migErr) {
    console.error("[DB] Role migration warning:", migErr.message);
  }

  // Seed default Users if none exist
  const userCount = db.prepare("SELECT count(*) as count FROM users").get();
  if (userCount.count === 0) {
    console.log("Seeding default users...");
    const insertUser = db.prepare(
      "INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)"
    );
    insertUser.run("Admin", "admin@pos.com", hashPassword("admin123"), "admin");
    insertUser.run("Billing Staff", "staff@pos.com", hashPassword("staff123"), "staff");
    console.log("Seeding complete.");
  }

  // Update password from 'owner123' to 'admin123' if it matches the legacy password
  try {
    const { verifyPassword } = require("../utils/auth");
    const adminUser = db.prepare("SELECT * FROM users WHERE email = ?").get("admin@pos.com");
    if (adminUser && verifyPassword("owner123", adminUser.password)) {
      db.prepare("UPDATE users SET password = ? WHERE id = ?").run(hashPassword("admin123"), adminUser.id);
      console.log("[DB] Migrated admin password to 'admin123'");
    }
  } catch (err) {
    console.error("[DB] Legacy password migration failed:", err.message);
  }

  // Seed default Settings if none exist
  const settingsCount = db.prepare("SELECT count(*) as count FROM settings").get();
  if (settingsCount.count === 0) {
    db.prepare("INSERT INTO settings (companyName, trn) VALUES (?, ?)").run("IMAGE OFFICE", "100335760300003");
  }
};

const connectDB = async () => {
  try {
    initSchema();
    console.log("SQLite Schema Initialized successfully");
  } catch (err) {
    console.error("Failed to initialize SQLite Database schema:", err);
    throw err;
  }
};

// Export connectDB as the default exports (backward compatible with require('./config/db'))
module.exports = connectDB;
// Attach db reference so controllers can require it
module.exports.db = db;
