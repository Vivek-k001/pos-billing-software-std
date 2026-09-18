import React, { useState, useMemo, useEffect } from "react";
import { Eye, Printer, Search, ShieldAlert, X } from "lucide-react";
import Sidebar from "../components/sidebar";
import "./invoicesHistory.css";
import "./dashboard.css"; // Reuse existing table and layout classes

const EMPTY_ROWS = 13;

const InvoicesHistory = ({ invoices = [], onRefresh, api }) => {
  const userRole = localStorage.getItem("userRole");
  const isOwner = userRole === "admin";

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [message, setMessage] = useState("");
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [confirmVoidId, setConfirmVoidId] = useState(null);



  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const invNum = (inv.invoiceNumber || "").toLowerCase();
      const custName = (inv.customer?.name || "").toLowerCase();
      const custContact = (inv.customer?.contact || "").toLowerCase();
      const custTrn = (inv.customer?.trn || "").toLowerCase();
      const term = searchTerm.toLowerCase();

      const matchesSearch =
        invNum.includes(term) ||
        custName.includes(term) ||
        custContact.includes(term) ||
        custTrn.includes(term);

      const matchesStatus =
        statusFilter === "All" ||
        inv.status === statusFilter;

      const invDate = inv.date ? new Date(inv.date).toISOString().split("T")[0] : "";
      const matchesStartDate = !startDate || invDate >= startDate;
      const matchesEndDate = !endDate || invDate <= endDate;

      return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
    });
  }, [invoices, searchTerm, statusFilter, startDate, endDate]);

  const executeVoid = async (id) => {
    setIsActionLoading(true);
    setMessage("");
    try {
      await api.voidInvoice(id);
      
      const voidedInv = invoices.find(i => i.id === id);
      const invNum = voidedInv?.invoiceNumber || `#${id}`;
      const custName = voidedInv?.customer?.name && voidedInv.customer.name !== "Cash Customer" 
        ? ` for ${voidedInv.customer.name}` 
        : "";
        
      setMessage(`Invoice ${invNum}${custName} was successfully voided.`);
      if (selectedInvoice && selectedInvoice.id === id) {
        setSelectedInvoice((prev) => ({ ...prev, status: "Voided" }));
      }
      await onRefresh?.();
    } catch (err) {
      setMessage(err.message || "Failed to void invoice.");
    } finally {
      setIsActionLoading(false);
      setConfirmVoidId(null);
    }
  };

  const openPrintModal = (invoice) => {
    setSelectedInvoice(invoice);
    setMessage("");
  };

  const closePrintModal = () => {
    setSelectedInvoice(null);
    setMessage("");
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Invoice Registry</h2>
            <p className="page-subtitle">Search, view, reprint, or void invoices</p>
          </div>
        </div>

        {message && !selectedInvoice && (
          <div style={{
            background: message.includes("success") ? "#c3e6cb" : "#fdf0f2",
            color: message.includes("success") ? "#155724" : "#c00026",
            padding: "12px 16px",
            borderRadius: "8px",
            fontWeight: "600",
            fontSize: "14px",
            marginBottom: "15px"
          }}>
            {message}
          </div>
        )}

        {/* Filters Panel */}
        <div className="card filters-card">
          <div className="filter-group">
            <label>Search</label>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Invoice No, customer, phone, TRN..."
                className="filter-input"
                style={{ width: "100%" }}
              />
            </div>
          </div>

          <div className="filter-group">
            <label>Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="filter-input"
            >
              <option value="All">All Invoices</option>
              <option value="Active">Active</option>
              <option value="Voided">Voided</option>
            </select>
          </div>

          <div className="filter-group">
            <label>From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="filter-input"
            />
          </div>
        </div>

        <div className="card" style={{ marginTop: "20px" }}>
          <div className="da-table-header">
            <h3 className="products-heading" style={{ margin: 0 }}>All Records</h3>
            <span className="da-inv-count">{filteredInvoices.length} found</span>
          </div>
          <div className="table-scroll" style={{ marginTop: "14px" }}>
            <table className="products-table">
              <thead>
                <tr>
                  <th>Inv. No</th>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Location</th>
                  <th>Grand Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id} style={{ opacity: invoice.status === "Voided" ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 600, color: "#c00026" }}>{invoice.invoiceNumber}</td>
                    <td>{invoice.date ? new Date(invoice.date).toLocaleDateString("en-AE") : "—"}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{invoice.customer?.name || "Cash Customer"}</div>
                      <div style={{ fontSize: "11px", color: "#666" }}>TRN: {invoice.customer?.trn || "N/A"}</div>
                    </td>
                    <td>{invoice.customer?.location || "—"}</td>
                    <td style={{ fontWeight: 700 }}>AED {(invoice.grandTotal || 0).toFixed(2)}</td>
                    <td>
                      <span style={{
                        background: "#f0f4ff",
                        color: "#3a5fd9",
                        padding: "3px 10px",
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600
                      }}>
                        {invoice.paymentMethod}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge ${invoice.status?.toLowerCase() || "active"}`}>
                        {invoice.status || "Active"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          className="btn-action-view"
                          onClick={() => openPrintModal(invoice)}
                          title="View & Print Invoice"
                        >
                          <Eye size={13} /> View / Print
                        </button>
                        {isOwner && invoice.status !== "Voided" && (
                          <button
                            className="btn-void"
                            onClick={() => setConfirmVoidId(invoice.id)}
                            title="Void Invoice"
                          >
                            <ShieldAlert size={13} /> Void
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 24 }}>
                      No invoices found matching criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── PRINT & VIEW DIALOG MODAL ── */}
      {selectedInvoice && (
        <div className="modal-overlay" onClick={closePrintModal}>
          <div className="modal-content-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Invoice Details ({selectedInvoice.invoiceNumber})</h3>
              <button className="modal-close-btn" onClick={closePrintModal}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {message && (
                <div style={{
                  color: message.includes("success") ? "#2a7d4f" : "#c00026",
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: "15px",
                  padding: "8px 12px",
                  background: message.includes("success") ? "#c3e6cb" : "#fdf0f2",
                  borderRadius: "6px"
                }}>
                  {message}
                </div>
              )}

              {/* ── PRINTABLE A4 (Rendered inside the modal) ── */}
              <div className="printable-invoice" style={{ display: "block", position: "relative", border: "1px solid #ddd", margin: "0 auto", boxShadow: "none", background: "#fff", width: "210mm", minHeight: "297mm" }}>
                
                {/* Visual watermark for voided invoice */}
                {selectedInvoice.status === "Voided" && (
                  <div style={{
                    position: "absolute",
                    top: "40%",
                    left: "50%",
                    transform: "translate(-50%, -50%) rotate(-30deg)",
                    color: "rgba(192, 0, 38, 0.15)",
                    fontSize: "80px",
                    fontWeight: "900",
                    border: "12px solid rgba(192, 0, 38, 0.15)",
                    padding: "10px 40px",
                    borderRadius: "20px",
                    letterSpacing: "8px",
                    zIndex: 10,
                    pointerEvents: "none"
                  }}>
                    VOIDED
                  </div>
                )}

                <div className="brand-strip">
                  <img src="/brand.jpg" alt="brand list" className="brand-strip-img"/>
                </div>
                <div className="inv-body">
                  <div className="inv-header">
                    <div className="inv-logo-block">
                      <img src="/logo.png" alt="logo" className="inv-logo"/>
                      <div className="logo-sub"></div>
                    </div>
                    <div className="inv-company-info">
                      <div className="company-arabic-name">إيـمـاج اوفـيـس سـيـلـوشـن لاصلاح الالات ومعدات النسخ والقرطاسية</div>
                      <div className="company-details-line">تلفون: ٧٩٣-٣٢٥١-٠٥٠ - ٤٣١-٧٤٣٢-٠٥٠ - فاكس: ٣٩٧-٧٢١٣-٠٣ - ص.ب: ٨٥٢٠٧ - الصناعية - العين</div>
                      <div className="company-details-line">Tel.: 050-3251793 - 050-7432431 · Fax: 03-7213397 · P.O.Box: 85207 - Industrial Area - Al Ain - U.A.E.</div>
                      <div className="company-details-line">e - m a i l :&nbsp;imagealain@gmail.com</div>
                    </div>
                  </div>
                  <div className="inv-title-row">
                    <span className="inv-title-eng">TAX INVOICE</span>
                    <span className="inv-title-arabic">فاتورة ضريبية</span>
                  </div>
                  <div className="trn-row">
                    <div className="trn-left">TRN: 100335760300003</div>    {/* edit akkanam */}
                    <div className="trn-right">
                      <span className="trn-label">Customer TRN:</span>
                      <div className="trn-boxes">
                        {Array.from({length:15}).map((_,i)=>(
                          <div className="trn-box" key={i}>{selectedInvoice.customer?.trn?.[i]||""}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <table className="info-table">
                    <tbody>
                      <tr>
                        <td className="info-cell" colSpan={2}>Inv. No. : <strong>{selectedInvoice.invoiceNumber}</strong></td>
                        <td className="info-cell">Date: <strong>{selectedInvoice.date ? new Date(selectedInvoice.date).toISOString().split("T")[0] : ""}</strong></td>
                      </tr>
                      <tr><td className="info-cell customer-name-cell" colSpan={3}>Customer Name: <strong>{selectedInvoice.customer?.name}</strong></td></tr>
                      <tr>
                        <td className="info-cell" colSpan={2}>Area/Location: <strong>{selectedInvoice.customer?.location}</strong></td>
                        <td className="info-cell">Contact No: <strong>{selectedInvoice.customer?.contact}</strong></td>
                      </tr>
                      <tr>
                        <td className="info-cell">Brand Name: <strong>{selectedInvoice.details?.brandName || "—"}</strong></td>
                        <td className="info-cell">Model: <strong>{selectedInvoice.details?.model || "—"}</strong></td>
                        <td className="info-cell">Total Cntr: <strong>{selectedInvoice.details?.totalCntr || "—"}</strong></td>
                      </tr>
                      <tr><td className="info-cell" colSpan={3}>Contract: <strong>{selectedInvoice.details?.contract || "—"}</strong></td></tr>
                    </tbody>
                  </table>
                  <hr className="black-separator" />
                  <table className="ref-table">
                    <tbody>
                      <tr>
                        <td className="ref-cell">D.N No: <strong>{selectedInvoice.details?.dnNo || "—"}</strong></td>
                        <td className="ref-cell">S.R No: <strong>{selectedInvoice.details?.srNo || "—"}</strong></td>
                        <td className="ref-cell">L.P.O No: <strong>{selectedInvoice.details?.lpoNo || "—"}</strong></td>
                      </tr>
                      <tr>
                        <td className="ref-cell">Date: <strong>{selectedInvoice.details?.dnDate || "—"}</strong></td>
                        <td className="ref-cell">Date: <strong>{selectedInvoice.details?.srDate || "—"}</strong></td>
                        <td className="ref-cell">Date: <strong>{selectedInvoice.details?.lpoDate || "—"}</strong></td>
                      </tr>
                    </tbody>
                  </table>
                  <table className="items-table">
                    <thead>
                      <tr className="items-header">
                        <th className="col-no"><div>الرقم</div><div>No.</div></th>
                        <th className="col-particulars"><div>التفاصيل</div><div>Particulars</div></th>
                        <th className="col-qty"><div>العدد</div><div>Qty.</div></th>
                        <th className="col-rate"><div>سعر الوحدة</div><div>Rate</div></th>
                        <th className="col-vat"><div>الضريبة</div><div>VAT</div></th>
                        <th className="col-total"><div>المبلغ الاجمالي</div><div>Total Amount</div></th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items?.map((p,i)=>(
                        <tr key={p.id || i}>
                          <td className="col-no">{i+1}</td>
                          <td className="col-particulars text-left">
                            {p.name}
                            {p.serialNumber && <span style={{ fontSize: "10px", color: "#666", display: "block" }}>S/N: {p.serialNumber}</span>}
                            {p.warrantyMonths > 0 && <span style={{ fontSize: "10px", color: "#666", display: "block" }}>Warranty: {p.warrantyMonths} Months</span>}
                          </td>
                          <td className="col-qty">{p.qty}</td>
                          <td className="col-rate">{p.rate ? Number(p.rate).toFixed(2) : "0.00"}</td>
                          <td className="col-vat">{p.vat ? Number(p.vat).toFixed(2) : "0.00"}</td>
                          <td className="col-total">{p.total ? Number(p.total).toFixed(2) : "0.00"}</td>
                        </tr>
                      ))}
                      {Array.from({length:Math.max(0,EMPTY_ROWS-(selectedInvoice.items?.length || 0))}).map((_,i)=>(
                        <tr key={`e-${i}`} className="empty-row">
                          <td/><td/><td/><td/><td/><td className="col-total"/>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="footer-note" colSpan={3} rowSpan={3}>Note: {selectedInvoice.details?.note || "N/A"}</td>
                        <td className="footer-label footer-pink" colSpan={2}>Without VAT</td>
                        <td className="footer-value footer-pink">{(selectedInvoice.subtotal || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="footer-label footer-pink" colSpan={2}>VAT @5%</td>
                        <td className="footer-value footer-pink">{(selectedInvoice.vatTotal || 0).toFixed(2)}</td>
                      </tr>
                      <tr>
                        <td className="footer-label footer-pink" colSpan={2}>Discount</td>
                        <td className="footer-value footer-pink">
                          {selectedInvoice.discountType === "percentage"
                            ? `${selectedInvoice.discount ? Number(selectedInvoice.discount).toFixed(2) : ""}`
                            : `${(selectedInvoice.discount || 0) > 0 ? Number(selectedInvoice.discount).toFixed(2) : ""}`
                          }
                        </td>
                      </tr>
                      <tr>
                        <td className="footer-total-dhs" colSpan={3}>Total Dhs. <strong>{(selectedInvoice.grandTotal || 0).toFixed(2)}</strong></td>
                        <td className="footer-label footer-pink" colSpan={2}>G. total</td>
                        <td className="footer-value footer-pink"><strong>{(selectedInvoice.grandTotal || 0).toFixed(2)}</strong></td>
                      </tr>
                    </tfoot>
                  </table>
                  <div className="payment-row">
                    <span className="payment-desc-label">Payment Description</span>
                    <span className="payment-opt">Cash: <span className="checkbox-box">{(selectedInvoice.paymentMethod || "Cash").includes("Cash") ? "✓" : ""}</span></span>
                    <span className="payment-opt">Cheque: <span className="checkbox-box">{selectedInvoice.paymentMethod?.includes("Cheque") ? "✓" : ""}</span></span>
                    <span className="payment-opt">Card: <span className="checkbox-box">{selectedInvoice.paymentMethod?.includes("Card") ? "✓" : ""}</span></span>
                    <span className="payment-opt">Bank Transfer: <span className="checkbox-box">{selectedInvoice.paymentMethod?.includes("Bank Transfer") ? "✓" : ""}</span></span>
                  </div>
                  <div className="signature-row" style={{ marginTop: "15mm" }}>
                    <span>Customer Signature:</span>
                    <span>For Image Office Solutions</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer-actions">
              {isOwner && selectedInvoice.status !== "Voided" && (
                <button
                  className="btn-void"
                  onClick={() => setConfirmVoidId(selectedInvoice.id)}
                  disabled={isActionLoading}
                  style={{ marginRight: "auto" }}
                >
                  <ShieldAlert size={15} /> Void Invoice
                </button>
              )}
              <button className="btn-secondary" onClick={closePrintModal}>
                Close
              </button>
              <button className="btn-primary" onClick={handlePrint}>
                <Printer size={15} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── CUSTOM CONFIRM DIALOG ── */}
      {confirmVoidId && (
        <div className="modal-overlay" style={{ zIndex: 9999, alignItems: "center" }}>
          <div className="modal-content-wrapper" style={{ padding: "30px", maxWidth: "420px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              <ShieldAlert size={48} color="#c00026" />
            </div>
            <h3 style={{ margin: "0 0 12px", color: "#1a1a2e", fontSize: "20px" }}>Void Invoice?</h3>
            <p style={{ margin: "0 0 24px", color: "#666", lineHeight: "1.5" }}>
              Are you sure you want to <strong>VOID</strong> this invoice? <br/>
              This action is permanent and will instantly restore the stock quantities of these items.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button 
                className="btn-secondary" 
                onClick={() => setConfirmVoidId(null)}
                disabled={isActionLoading}
                style={{ flex: 1, padding: "10px" }}
              >
                Cancel
              </button>
              <button 
                className="btn-void" 
                onClick={() => executeVoid(confirmVoidId)}
                disabled={isActionLoading}
                style={{ flex: 1, padding: "10px" }}
              >
                {isActionLoading ? "Voiding..." : "Yes, Void It"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default InvoicesHistory;
