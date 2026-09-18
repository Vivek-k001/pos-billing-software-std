import React, { useState, useEffect } from "react";
import Sidebar from "../components/sidebar";
import { groupInvoicesByWeek, getTodayKey, normalizeInvoice, summarizeInvoices, toDateKey, toMonthKey } from "../utils/reports";
import "./dashboard.css";
import "./dashboard-analytics.css";

const DonutChart = ({ segments, size = 180, stroke = 32, children }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
      <circle cx={center} cy={center} r={radius} fill="none" stroke="#f0dfe4" strokeWidth={stroke} />
      {segments.map((segment, index) => {
        const dash = (segment.pct / 100) * circumference;
        const offset = segments
          .slice(0, index)
          .reduce((sum, current) => sum + current.pct, 0);

        return (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth={stroke}
            strokeDasharray={`${dash} ${circumference - dash}`}
            strokeDashoffset={(-offset * circumference) / 100}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}
          />
        );
      })}
      {children && (
        <foreignObject x={stroke / 2} y={stroke / 2} width={size - stroke} height={size - stroke}>
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            transform: "rotate(90deg)"
          }}>
            {children}
          </div>
        </foreignObject>
      )}
    </svg>
  );
};

const BarChart = ({ data, color = "#c00026" }) => {
  const max = Math.max(...data.map((entry) => entry.value), 1);

  return (
    <div className="bar-chart">
      {data.map((entry, index) => (
        <div key={entry.label} className="bar-item">
          <div className="bar-wrap">
            <div
              className="bar-fill"
              style={{
                height: `${(entry.value / max) * 100}%`,
                background: color,
                opacity: 0.7 + (index / Math.max(data.length, 1)) * 0.3
              }}
            />
          </div>
          <div className="bar-label">{entry.label}</div>
          <div className="bar-value">AED {entry.value.toLocaleString()}</div>
        </div>
      ))}
    </div>
  );
};

const BackupStatusWidget = ({ api }) => {
  const [status, setStatus] = useState({ configured: false, lastBackup: null });
  const [loading, setLoading] = useState(true);
  const [showConfig, setShowConfig] = useState(false);
  const [onedrivePath, setOnedrivePath] = useState("");

  // --- New state for Hybrid approach UX (Easy to remove later) ---
  const [saveState, setSaveState] = useState("idle"); // "idle" | "saving" | "success"
  const [showToast, setShowToast] = useState(false);

  const loadStatus = async () => {
    if (!api) return;
    try {
      const res = await api.getExcelBackupStatus();
      setStatus(res);
      if (res.onedrivePath !== undefined) {
        setOnedrivePath(res.onedrivePath);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, [api]);

  const handleSelectFolder = async () => {
    if (window.electronAPI && window.electronAPI.selectFolder) {
      const folderPath = await window.electronAPI.selectFolder();
      if (folderPath) {
        if (!folderPath.toLowerCase().includes("onedrive")) {
          alert("Warning: The selected folder path doesn't contain 'OneDrive'. Please make sure it's the correct folder.");
        }
        setOnedrivePath(folderPath);
      }
    } else {
      alert("Folder selection is only available in the desktop app.");
    }
  };

  const handleSaveConfig = async () => {
    if (!api) return;
    setSaveState("saving");
    try {
      await api.updateSettings({ onedrivePath });

      // Artificial minimum delay for smooth spinning animation perception
      await new Promise(r => setTimeout(r, 800));

      setSaveState("success");
      setShowToast(true); // Trigger the glassmorphic slide in
      loadStatus();

      // Auto-reset state and hide configuring window after 3s
      setTimeout(() => {
        setShowToast(false);
        setSaveState("idle");
        setShowConfig(false);
      }, 3000);

    } catch (e) {
      setSaveState("idle");
      alert("Failed to save settings: " + e.message);
    }
  };

  if (loading) return <div className="backup-widget loading">Checking backup...</div>;

  let stateColor = "white"; // "OneDrive Not Configured"
  let stateText = "OneDrive Not Configured";
  let icon = "⚪";

  if (status.configured) {
    if (!status.lastBackup) {
      stateColor = "red";
      stateText = "Never Backed Up";
      icon = "🔴";
    } else {
      const lastBackupDate = new Date(status.lastBackup);
      const isStale = (new Date() - lastBackupDate) > 2 * 24 * 60 * 60 * 1000;
      if (isStale) {
        stateColor = "yellow";
        const days = Math.floor((new Date() - lastBackupDate) / (1000 * 60 * 60 * 24));
        stateText = `Last Backup: ${days} days ago`;
        icon = "🟡";
      } else {
        stateColor = "green";
        const formattedDate = lastBackupDate.toLocaleDateString("en-AE", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
        stateText = `Last Backup: ${formattedDate}`;
        icon = "🟢";
      }
    }
  }

  return (
    <div className="backup-widget-container" style={{ position: "relative" }}>

      {/* ── Keyframes injected for our animations ── */}
      <style>{`
        @keyframes toastSlideIn {
          0% { transform: translate(100%, 20px) scale(0.9); opacity: 0; }
          100% { transform: translate(0, 0) scale(1); opacity: 1; }
        }
        @keyframes toastSlideOut {
          0% { transform: translate(0, 0) scale(1); opacity: 1; }
          100% { transform: translate(100%, -20px) scale(0.9); opacity: 0; }
        }
        @keyframes spinGear {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes shrinkProgress {
          0% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>

      <div
        className={`backup-widget glass ${stateColor}`}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 16px", borderRadius: "50px",
          background: "rgba(255, 255, 255, 0.4)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          color: "#333", fontWeight: "600", fontSize: "14px"
        }}
      >
        <span>{icon}</span>
        <span>{stateText}</span>
          <button
            onClick={() => setShowConfig(!showConfig)}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "16px", padding: 0, marginLeft: "4px",
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "24px", height: "24px" // Fixed dimensions to prevent layout shifts
            }}
            title="Configure OneDrive Backup"
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: showConfig ? "rotate(180deg)" : "rotate(0deg)",
              transformOrigin: "center center",
              lineHeight: 1, // Ensures the bounding box exactly fits the emoji
              width: "16px", height: "16px"
            }}>
              ⚙️
            </span>
          </button>
      </div>

      {showConfig && (
        <div style={{
          position: "absolute", top: "100%", right: 0, marginTop: "8px",
          background: "white", padding: "12px", borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)", zIndex: 10,
          width: "300px", display: "flex", flexDirection: "column", gap: "8px"
        }}>
          <div style={{ fontSize: "13px", fontWeight: "600", color: "#333" }}>Configure OneDrive Path</div>
          <p style={{ fontSize: "11px", color: "#666", margin: 0 }}>
            Enter the local path to your OneDrive folder (e.g., C:\Users\User\OneDrive\POS Backups)
          </p>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              value={onedrivePath}
              onChange={(e) => setOnedrivePath(e.target.value)}
              style={{ flex: 1, padding: "6px", fontSize: "12px", borderRadius: "4px", border: "1px solid #ccc" }}
              placeholder="C:\..."
            />
            <button
              onClick={handleSelectFolder}
              style={{
                background: "#f0f0f0", border: "1px solid #ccc", borderRadius: "4px",
                cursor: "pointer", padding: "4px 8px", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center"
              }}
              title="Select Folder"
            >
              📁
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
            <button
              onClick={() => setShowConfig(false)}
              disabled={saveState !== "idle"}
              style={{ padding: "4px 8px", fontSize: "12px", background: "#f0f0f0", border: "none", borderRadius: "4px", cursor: saveState !== "idle" ? "not-allowed" : "pointer", opacity: saveState !== "idle" ? 0.6 : 1 }}
            >
              Cancel
            </button>
            <button
              onClick={handleSaveConfig}
              disabled={saveState !== "idle"}
              style={{
                padding: "4px 12px",
                fontSize: "12px",
                background: saveState === "success" ? "#2a7d4f" : "#c00026",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: saveState !== "idle" ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                transition: "all 0.3s ease",
                minWidth: "85px",
                justifyContent: "center"
              }}
            >
              {saveState === "idle" && "Save"}
              {saveState === "saving" && (
                <>
                  <span style={{ display: "inline-block", animation: "spinGear 1.2s linear infinite", lineHeight: "1" }}>⚙️</span>
                  Saving...
                </>
              )}
              {saveState === "success" && (
                <>
                  ✅ Saved!
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Fixed Toast Popup ── */}
      {showToast && (
        <div style={{
          position: "fixed",
          bottom: "30px",
          right: "30px",
          zIndex: 9999,
          background: "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.7)",
          boxShadow: "0 10px 30px rgba(0,0,0,0.1)",
          borderRadius: "12px",
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          overflow: "hidden",
          animation: "toastSlideIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards"
        }}>
          <div style={{ fontSize: "24px", lineHeight: "1" }}>✅</div>
          <div>
            <div style={{ fontSize: "14px", fontWeight: "700", color: "#111" }}>Setup Complete</div>
            <div style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>OneDrive sync is successfully configured.</div>
          </div>
          {/* Progress bar line at the bottom */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            height: "4px",
            background: "linear-gradient(90deg, #2a7d4f, #4cc380)",
            animation: "shrinkProgress 3s linear forwards"
          }} />
        </div>
      )}
    </div>
  );
};

const InternetStatusWidget = ({ api }) => {
  const [isOnline, setIsOnline] = useState(true);

  const verifyConnection = async () => {
    if (!api || typeof api.checkInternetConnection !== "function") return;
    try {
      const res = await api.checkInternetConnection();
      if (res && typeof res.online === "boolean") {
        setIsOnline(res.online);
      }
    } catch (e) {
      setIsOnline(false);
    }
  };

  useEffect(() => {
    // Initial check on mount
    verifyConnection();

    // Check periodically in the background (every 7 seconds)
    const interval = setInterval(verifyConnection, 7000);

    // Event listeners to trigger check immediately on connectivity state change detect
    const handleOnlineEvent = () => verifyConnection();
    const handleOfflineEvent = () => verifyConnection();

    window.addEventListener("online", handleOnlineEvent);
    window.addEventListener("offline", handleOfflineEvent);

    return () => {
      clearInterval(interval);
      window.removeEventListener("online", handleOnlineEvent);
      window.removeEventListener("offline", handleOfflineEvent);
    };
  }, [api]);

  const stateColor = isOnline ? "green" : "red";
  const icon = isOnline ? "🟢" : "🔴";
  const stateText = isOnline ? "Internet: Connected" : "Internet: Offline";

  return (
    <div className="backup-widget-container">
      <div
        className={`backup-widget glass ${stateColor}`}
        style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "8px 16px", borderRadius: "50px",
          background: "rgba(255, 255, 255, 0.4)",
          backdropFilter: "blur(10px)",
          border: "1px solid rgba(255, 255, 255, 0.5)",
          boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
          color: "#333", fontWeight: "600", fontSize: "14px"
        }}
      >
        <span>{icon}</span>
        <span>{stateText}</span>
      </div>
    </div>
  );
};

const Dashboard = ({ products = [], invoices = [], api }) => {
  const todayLabel = new Date().toLocaleDateString("en-AE", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const normalizedInvoices = invoices.map(normalizeInvoice);
  const todayInvoices = normalizedInvoices.filter((invoice) => toDateKey(invoice.date) === getTodayKey());
  const monthKey = toMonthKey(new Date());
  const monthlyInvoices = normalizedInvoices.filter((invoice) => toMonthKey(invoice.date) === monthKey);

  // These summaries feed every stat, chart, and table from the same live invoice data.
  const daySummary = summarizeInvoices(todayInvoices);
  const monthlySummary = summarizeInvoices(monthlyInvoices);
  const monthlyWeeks = groupInvoicesByWeek(monthlyInvoices);
  const cashAmount = todayInvoices
    .filter((invoice) => invoice.payment === "Cash")
    .reduce((sum, invoice) => sum + invoice.grand, 0);
  const chequeAmount = todayInvoices
    .filter((invoice) => invoice.payment === "Cheque")
    .reduce((sum, invoice) => sum + invoice.grand, 0);
  const cashPct = daySummary.grand ? Math.round((cashAmount / daySummary.grand) * 100) : 0;
  const chequePct = daySummary.grand ? Math.max(100 - cashPct, 0) : 0;

  const weekPercents = monthlyWeeks.map((week, index) => {
    if (!monthlySummary.grand) return 0;
    if (index === monthlyWeeks.length - 1) {
      return Math.max(100 - monthlyWeeks.slice(0, -1).reduce((sum, entry) => sum + Math.round((entry.grand / monthlySummary.grand) * 100), 0), 0);
    }
    return Math.round((week.grand / monthlySummary.grand) * 100);
  });
  const weekColors = ["#c00026", "#e07090", "#edb9c7", "#f5d5df", "#f9e8ee"];

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-main">
        <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div>
              <h2 className="page-title">Analytics Dashboard</h2>
              <p className="page-subtitle">{todayLabel}</p>
            </div>

          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end" }}>
            <BackupStatusWidget api={api} />
            <InternetStatusWidget api={api} />
          </div>
        </div>

        <div className="da-stats-row">
          <div className="da-stat-card">
            <div className="da-stat-icon" style={{ background: "#fff0f2", color: "#c00026" }}>AED</div>
            <div>
              <div className="da-stat-value">AED {daySummary.grand.toFixed(2)}</div>
              <div className="da-stat-label">Today's Revenue</div>
            </div>
          </div>
          <div className="da-stat-card">
            <div className="da-stat-icon" style={{ background: "#f0fff6", color: "#2a7d4f" }}>{products.length}</div>
            <div>
              <div className="da-stat-value">{daySummary.items}</div>
              <div className="da-stat-label">Products Sold Today</div>
            </div>
          </div>
          <div className="da-stat-card">
            <div className="da-stat-icon" style={{ background: "#fff8ed", color: "#d4820a" }}>%</div>
            <div>
              <div className="da-stat-value">AED {daySummary.vat.toFixed(2)}</div>
              <div className="da-stat-label">VAT Collected Today</div>
            </div>
          </div>
          <div className="da-stat-card">
            <div className="da-stat-icon" style={{ background: "#f5f0ff", color: "#7c3aed" }}>M</div>
            <div>
              <div className="da-stat-value">AED {monthlySummary.grand.toLocaleString()}</div>
              <div className="da-stat-label">Monthly Revenue</div>
            </div>
          </div>
        </div>

        <div className="da-charts-row">
          <div className="da-chart-card">
            <div className="da-chart-title">
              Daily Payment Split
              <span className="da-chart-sub">Today's invoices</span>
            </div>

            <div className="da-donut-wrap">
              <DonutChart
                size={180}
                stroke={30}
                segments={[
                  { pct: cashPct, color: "#c00026" },
                  { pct: chequePct, color: "#edb9c7" }
                ]}
              >
                <div style={{ fontWeight: 700, fontSize: 22, color: "#c00026", lineHeight: 1 }}>{todayInvoices.length}</div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Invoices</div>
              </DonutChart>

              <div className="da-legend">
                <div className="da-legend-item">
                  <span className="da-dot" style={{ background: "#c00026" }} />
                  <div>
                    <div className="da-leg-label">Cash</div>
                    <div className="da-leg-val">AED {cashAmount.toFixed(2)} <em>({cashPct}%)</em></div>
                  </div>
                </div>
                <div className="da-legend-item">
                  <span className="da-dot" style={{ background: "#edb9c7" }} />
                  <div>
                    <div className="da-leg-label">Cheque</div>
                    <div className="da-leg-val">AED {chequeAmount.toFixed(2)} <em>({chequePct}%)</em></div>
                  </div>
                </div>
                <div className="da-legend-item">
                  <span className="da-dot" style={{ background: "#f5f0ff" }} />
                  <div>
                    <div className="da-leg-label">Items Sold</div>
                    <div className="da-leg-val">{daySummary.items} products</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="da-chart-card">
            <div className="da-chart-title">
              Monthly Week Breakdown
              <span className="da-chart-sub">{monthlySummary.invoices} invoices this month</span>
            </div>

            <div className="da-donut-wrap">
              <DonutChart
                size={180}
                stroke={30}
                segments={monthlyWeeks.map((week, index) => ({
                  pct: weekPercents[index] || 0,
                  color: weekColors[index] || "#f9e8ee"
                }))}
              >
                <div style={{ fontWeight: 700, fontSize: 20, color: "#c00026", lineHeight: 1 }}>
                  {monthlySummary.invoices}
                </div>
                <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>Total Inv.</div>
              </DonutChart>

              <div className="da-legend">
                {monthlyWeeks.map((week, index) => (
                  <div key={week.week} className="da-legend-item">
                    <span className="da-dot" style={{ background: weekColors[index] || "#f9e8ee" }} />
                    <div>
                      <div className="da-leg-label">{week.week} - {week.invoices} inv.</div>
                      <div className="da-leg-val">AED {week.grand.toLocaleString()} <em>({weekPercents[index] || 0}%)</em></div>
                    </div>
                  </div>
                ))}
                {monthlyWeeks.length === 0 && <div className="da-leg-val">No invoices this month.</div>}
              </div>
            </div>
          </div>

          <div className="da-chart-card da-bar-card">
            <div className="da-chart-title">
              Monthly Revenue Bars
              <span className="da-chart-sub">Week-by-week breakdown</span>
            </div>
            <BarChart
              data={(monthlyWeeks.length ? monthlyWeeks : [{ week: "Week 1", grand: 0 }]).map((week) => ({
                label: week.week,
                value: week.grand
              }))}
              color="#c00026"
            />
            <div className="da-bar-total">
              Total: <strong>AED {monthlySummary.grand.toLocaleString()}</strong>
              &nbsp;-&nbsp; VAT: <strong>AED {monthlySummary.vat.toFixed(2)}</strong>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="da-table-header">
            <h3 className="products-heading" style={{ margin: 0 }}>Today's Invoices</h3>
            <span className="da-inv-count">{todayInvoices.length} records</span>
          </div>
          <div className="table-scroll" style={{ marginTop: 14 }}>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Inv. No</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Without VAT</th>
                  <th>VAT (5%)</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {todayInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: 600, color: "#c00026" }}>{invoice.invNo}</td>
                    <td>{invoice.customer}</td>
                    <td style={{ textAlign: "center" }}>{invoice.items}</td>
                    <td>AED {invoice.total.toFixed(2)}</td>
                    <td>AED {invoice.vat.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>AED {invoice.grand.toFixed(2)}</td>
                    <td>
                      <span style={{
                        background: invoice.payment === "Cash" ? "#f0fff6" : "#f0f4ff",
                        color: invoice.payment === "Cash" ? "#2a7d4f" : "#3a5fd9",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600
                      }}>{invoice.payment}</span>
                    </td>
                  </tr>
                ))}
                {todayInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 18 }}>
                      No invoices found for today.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr style={{ background: "#fce4ec", fontWeight: 700 }}>
                  <td colSpan={2}>Total</td>
                  <td style={{ textAlign: "center" }}>{daySummary.items}</td>
                  <td>AED {daySummary.total.toFixed(2)}</td>
                  <td>AED {daySummary.vat.toFixed(2)}</td>
                  <td>AED {daySummary.grand.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
