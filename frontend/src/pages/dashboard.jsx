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
