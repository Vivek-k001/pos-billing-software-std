import React, { useMemo, useState } from "react";
import Sidebar from "../components/sidebar";
import { groupInvoicesByWeek, normalizeInvoice, toMonthKey } from "../utils/reports";
import "./dashboard.css";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const MonthlyReport = ({ invoices = [] }) => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());

  const weeklyData = useMemo(() => {
    const selectedMonth = `${year}-${String(month + 1).padStart(2, "0")}`;
    const monthInvoices = invoices
      .map(normalizeInvoice)
      .filter((invoice) => toMonthKey(invoice.date) === selectedMonth);
    return groupInvoicesByWeek(monthInvoices);
  }, [invoices, month, year]);
  const summary = weeklyData.reduce(
    (totals, week) => ({
      invoices: totals.invoices + week.invoices,
      total: totals.total + week.total,
      vat: totals.vat + week.vat,
      grand: totals.grand + week.grand
    }),
    { invoices: 0, total: 0, vat: 0, grand: 0 }
  );
  const avgWeeklyRevenue = weeklyData.length ? summary.grand / weeklyData.length : 0;

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">
              Monthly Report
            </h2>
            <p className="page-subtitle">Full monthly analytics and breakdown</p>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
              style={{
                padding: "9px 12px", border: "1.5px solid #e8e0e2",
                borderRadius: "8px", fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none"
              }}>
              {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
            </select>
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}
              style={{
                padding: "9px 12px", border: "1.5px solid #e8e0e2",
                borderRadius: "8px", fontSize: 13, fontFamily: "DM Sans,sans-serif", outline: "none"
              }}>
              {[2023, 2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fff0f2", color: "#c00026" }}>#</div>
            <div><div className="stat-value">{summary.invoices}</div><div className="stat-label">Total Invoices</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f0fff6", color: "#2a7d4f" }}>AED</div>
            <div><div className="stat-value">AED {summary.grand.toLocaleString()}</div><div className="stat-label">Total Revenue</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fff8ed", color: "#d4820a" }}>%</div>
            <div><div className="stat-value">AED {summary.vat.toFixed(2)}</div><div className="stat-label">VAT Collected</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f5f0ff", color: "#7c3aed" }}>M</div>
            <div>
              <div className="stat-value">AED {avgWeeklyRevenue.toFixed(0)}</div>
              <div className="stat-label">Avg. Weekly Rev.</div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="products-heading">{MONTHS[month]} {year} - Weekly Breakdown</h3>
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Period</th><th>Invoices</th><th>Revenue (AED)</th>
                  <th>VAT (AED)</th><th>Grand Total (AED)</th>
                </tr>
              </thead>
              <tbody>
                {weeklyData.map((week) => (
                  <tr key={week.week}>
                    <td style={{ fontWeight: 600 }}>{week.week}</td>
                    <td>{week.invoices}</td>
                    <td>{week.total.toLocaleString()}</td>
                    <td>{week.vat.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>{week.grand.toFixed(2)}</td>
                  </tr>
                ))}
                {weeklyData.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 18 }}>
                      No invoices found for this month.
                    </td>
                  </tr>
                )}
                <tr style={{ background: "#fce4ec", fontWeight: 700 }}>
                  <td>Total</td>
                  <td>{summary.invoices}</td>
                  <td>{summary.total.toLocaleString()}</td>
                  <td>{summary.vat.toFixed(2)}</td>
                  <td>{summary.grand.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonthlyReport;
