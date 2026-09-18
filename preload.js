/**
 * preload.js
 * Runs in Electron's renderer process before the page loads.
 * Uses contextBridge to safely expose a limited Electron API to the frontend
 * without enabling full Node.js access (nodeIntegration stays false).
 */
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  /**
   * Open a local file (e.g. a PDF) using the OS default application.
   * @param {string} filePath  Absolute path to the file.
   * @returns {Promise<string>} Empty string on success, error message on failure.
   */
  openPdf: (filePath) => ipcRenderer.invoke("shell:openPath", filePath),
  selectFolder: () => ipcRenderer.invoke("dialog:selectFolder"),
});
