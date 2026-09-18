const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const path = require("path");
const http = require("http");

// Load environment variables from backend/.env
const backendEnvPath = path.join(__dirname, "backend", ".env");
require("dotenv").config({ path: backendEnvPath });

const PORT = process.env.PORT || 5000;

// Set the SQLite database path to the Electron user data directory
// This guarantees that the SQLite database file persists in AppData (on Windows)
// across updates, and is not overwritten or lost when the app is packaged.
const userDataPath = app.getPath("userData");
const sqliteDbDir = path.join(userDataPath, "database");
if (!require("fs").existsSync(sqliteDbDir)) {
  require("fs").mkdirSync(sqliteDbDir, { recursive: true });
}
process.env.SQLITE_DB_PATH   = path.join(sqliteDbDir, "pos.db");
// Forward userData path so backend services can write
// to a safe, writable location in both dev and packaged Electron builds.
process.env.ELECTRON_USER_DATA = userDataPath;

let mainWindow;

// Require the backend Express server to boot it up in this process
console.log("Starting backend server inside Electron main process...");
try {
  require("./backend/server.js");
} catch (err) {
  console.error("Error starting backend server:", err);
}

// Helper to poll the backend health endpoint until it is ready
function pollServer(url, timeoutMs, callback) {
  const startTime = Date.now();
  const check = () => {
    http.get(url, (res) => {
      if (res.statusCode === 200) {
        callback(null);
      } else {
        retry();
      }
    }).on("error", (err) => {
      retry();
    });
  };

  const retry = () => {
    if (Date.now() - startTime > timeoutMs) {
      callback(new Error("Timeout waiting for local server to start"));
    } else {
      setTimeout(check, 150);
    }
  };

  check();
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    title: "Image Office POS",
    icon: path.join(__dirname, "frontend", "public", "logo1.ico"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js")
    }
  });

  // Hide the default electron menu bar for a cleaner desktop UI
  mainWindow.setMenuBarVisibility(false);
  
  // Maximize and show the window only when it is ready, avoiding visual glitching
  mainWindow.once("ready-to-show", () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  const serverUrl = `http://localhost:${PORT}`;
  console.log(`Polling server at ${serverUrl}/api/health...`);

  pollServer(`${serverUrl}/api/health`, 8000, (err) => {
    if (err) {
      console.error(err.message);
      mainWindow.loadURL(serverUrl);
    } else {
      console.log("Backend server ready. Loading frontend...");
      mainWindow.loadURL(serverUrl);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── IPC: open a local PDF (or any file) with the OS default application ──
// shell.openPath returns an empty string on success, an error message on failure.
ipcMain.handle("shell:openPath", async (_event, filePath) => {
  const error = await shell.openPath(filePath);
  return error; // empty string = success
});

ipcMain.handle("dialog:selectFolder", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) {
    return null;
  } else {
    return result.filePaths[0];
  }
});

app.on("ready", createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
