import React, { useMemo, useState } from "react";
import Sidebar from "../components/sidebar";
import { getTodayKey, normalizeInvoice, summarizeInvoices, toDateKey } from "../utils/reports";
import "./dashboard.css";

const DailyReport = ({ invoices = [] }) => {
  const [selectedDate, setSelectedDate] = useState(getTodayKey());

  const dailyInvoices = useMemo(() => {
    return invoices
      .map(normalizeInvoice)
      .filter((invoice) => toDateKey(invoice.date) === selectedDate);
  }, [invoices, selectedDate]);
  const summary = summarizeInvoices(dailyInvoices);

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Daily Report</h2>
            <p className="page-subtitle">All invoices issued on the selected date</p>
          </div>
          <input type="date" value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{ padding: "9px 14px", border: "1.5px solid #e8e0e2",
              borderRadius: "8px", fontSize: 13, fontFamily: "DM Sans,sans-serif",
              outline: "none" }} />
        </div>

        <div className="stats-grid" style={{ marginBottom: 16 }}>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fff0f2", color: "#c00026" }}>#</div>
            <div><div className="stat-value">{summary.invoices}</div><div className="stat-label">Invoices</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#f0fff6", color: "#2a7d4f" }}>AED</div>
            <div><div className="stat-value">AED {summary.grand.toFixed(2)}</div><div className="stat-label">Total Revenue</div></div>
          </div>
          <div className="stat-card">
            <div className="stat-icon" style={{ background: "#fff8ed", color: "#d4820a" }}>%</div>
            <div><div className="stat-value">AED {summary.vat.toFixed(2)}</div><div className="stat-label">VAT Collected</div></div>
          </div>
        </div>

        <div className="card">
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Inv. No</th><th>Customer</th><th>Without VAT</th>
                  <th>VAT (5%)</th><th>Grand Total</th><th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {dailyInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td style={{ fontWeight: 600, color: "#c00026" }}>{invoice.invNo}</td>
                    <td>{invoice.customer}</td>
                    <td>AED {invoice.total.toFixed(2)}</td>
                    <td>AED {invoice.vat.toFixed(2)}</td>
                    <td style={{ fontWeight: 700 }}>AED {invoice.grand.toFixed(2)}</td>
                    <td>
                      <span style={{
                        background: invoice.payment === "Cash" ? "#f0fff6" : "#f0f4ff",
                        color: invoice.payment === "Cash" ? "#2a7d4f" : "#3a5fd9",
                        padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600
                      }}>{invoice.payment}</span>
                    </td>
                  </tr>
                ))}
                {dailyInvoices.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 18 }}>
                      No invoices found for this date.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DailyReport;
