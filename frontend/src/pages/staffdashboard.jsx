import React, { useMemo, useState } from "react";
import { Plus, Printer, Save, Trash2, RotateCcw, X, Eye } from "lucide-react";
import Sidebar from "../components/sidebar";
import "./dashboard.css";

const EMPTY_ROWS = 13;

const StaffDashboard = ({ productsCatalog = [], onCreateInvoice, onRefresh, invoices = [], api }) => {
  const [invoiceDetails, setInvoiceDetails] = useState({
    invNo: "", date: new Date().toISOString().split("T")[0],
    customerName: "", location: "", contactNo: "",
    brandName: "", model: "", totalCntr: "", contract: "",
    customerTrn: "", dnNo: "", dnDate: "", srNo: "", srDate: "",
    lpoNo: "", lpoDate: "", note: "",
    paymentMethod: "Cash",
    discount: "", discountType: "flat"
  });

  const [products, setProducts] = useState([
    { id: 1, productId: "", name: "", quantity: "", price: "", vat: 0, total: 0, vatApplicable: true, vatRate: 5, stock: 0 },
  ]);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [savedInvoice, setSavedInvoice] = useState(null);
  const [showSavedModal, setShowSavedModal] = useState(false);

  // Compile list of unique past customers to support autocompletion
  const uniqueCustomers = useMemo(() => {
    const customerMap = new Map();
    invoices.forEach((inv) => {
      if (inv.customer?.name) {
        const nameKey = inv.customer.name.trim().toLowerCase();
        if (!customerMap.has(nameKey)) {
          customerMap.set(nameKey, {
            name: inv.customer.name,
            location: inv.customer.location || "",
            contact: inv.customer.contact || "",
            trn: inv.customer.trn || ""
          });
        }
      }
    });
    return Array.from(customerMap.values());
  }, [invoices]);

  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [showContactSuggestions, setShowContactSuggestions] = useState(false);
  const [activeProductRowId, setActiveProductRowId] = useState(null);

  const nameSuggestions = useMemo(() => {
    const query = invoiceDetails.customerName.trim().toLowerCase();
    if (!query) return [];
    return uniqueCustomers.filter((c) =>
      c.name.toLowerCase().includes(query)
    );
  }, [uniqueCustomers, invoiceDetails.customerName]);

  const contactSuggestions = useMemo(() => {
    const query = invoiceDetails.contactNo.trim().toLowerCase();
    if (!query) return [];
    return uniqueCustomers.filter((c) =>
      c.contact && c.contact.toLowerCase().includes(query)
    );
  }, [uniqueCustomers, invoiceDetails.contactNo]);

  const selectCustomer = (c) => {
    setInvoiceDetails((prev) => ({
      ...prev,
      customerName: c.name,
      location: c.location,
      contactNo: c.contact,
      customerTrn: c.trn
    }));
    setShowNameSuggestions(false);
    setShowContactSuggestions(false);
  };

  const getProductSuggestions = (val) => {
    const query = val.trim().toLowerCase();
    if (!query) return [];
    return productsCatalog.filter((product) => {
      const nameMatch = product.name.toLowerCase().includes(query);
      const skuMatch = product.sku ? product.sku.toLowerCase().includes(query) : false;
      return nameMatch || skuMatch;
    });
  };

  const selectProduct = (rowId, product) => {
    setProducts(products.map((p) => {
      if (p.id !== rowId) return p;

      const qty = Number(p.quantity) || 1;
      const price = Number(product.price) || 0;
      const total = qty * price;
      const rateVal = product.vatApplicable !== false ? (typeof product.vat === "number" ? product.vat : 5) : 0;
      const vat = total * (rateVal / 100);

      return {
        ...p,
        productId: product.id,
        name: product.name,
        price: product.price,
        stock: product.stock || 0,
        vatApplicable: product.vatApplicable !== false,
        vatRate: typeof product.vat === "number" ? product.vat : 5,
        total,
        vat
      };
    }));
    setActiveProductRowId(null);
  };

  const handleCustomerNameChange = (e) => {
    const nameValue = e.target.value;
    const matchedCustomer = uniqueCustomers.find(
      (c) => c.name.toLowerCase() === nameValue.trim().toLowerCase()
    );

    setInvoiceDetails((prev) => {
      const nextDetails = { ...prev, customerName: nameValue };
      if (matchedCustomer) {
        nextDetails.location = matchedCustomer.location;
        nextDetails.contactNo = matchedCustomer.contact;
        nextDetails.customerTrn = matchedCustomer.trn;
      }
      return nextDetails;
    });
  };

  const handleCustomerContactChange = (e) => {
    const contactValue = e.target.value;
    const matchedCustomer = uniqueCustomers.find(
      (c) => c.contact && c.contact.trim() === contactValue.trim()
    );

    setInvoiceDetails((prev) => {
      const nextDetails = { ...prev, contactNo: contactValue };
      if (matchedCustomer) {
        nextDetails.customerName = matchedCustomer.name;
        nextDetails.location = matchedCustomer.location;
        nextDetails.customerTrn = matchedCustomer.trn;
      }
      return nextDetails;
    });
  };

  const { subTotal, totalVat, grandTotal } = useMemo(() => {
    let sub = 0, vat = 0;
    products.forEach((p) => {
      const line = Number(p.quantity) * Number(p.price);
      sub += line;

      // Calculate dynamic VAT based on product settings
      const rate = p.vatApplicable !== false ? (p.vatRate !== undefined ? p.vatRate : 5) : 0;
      vat += line * (rate / 100);
    });

    const disc = Number(invoiceDetails.discount) || 0;
    const discAmount = invoiceDetails.discountType === "percentage" ? sub * (disc / 100) : disc;
    return { subTotal: sub, totalVat: vat, grandTotal: Math.max(sub + vat - discAmount, 0) };
  }, [products, invoiceDetails.discount, invoiceDetails.discountType]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setInvoiceDetails((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
  };

  const findCatalogProduct = (value) => {
    const query = value.trim().toLowerCase();
    if (!query) return null;
    return productsCatalog.find((product) => {
      const canonicalName = product.name.toLowerCase();
      const canonicalSku = product.sku ? product.sku.trim().toLowerCase() : "";
      const composite = product.sku ? `${product.name} (${product.sku})`.toLowerCase() : canonicalName;

      return (
        canonicalName === query ||
        canonicalSku === query ||
        composite === query
      );
    });
  };

  const updateProduct = (id, field, value) => {
    setProducts(products.map((p) => {
      if (p.id !== id) return p;
      const u = { ...p, [field]: value };
      const matchedProduct = field === "name" ? findCatalogProduct(value) : null;

      if (matchedProduct) {
        u.productId = matchedProduct.id;
        u.name = matchedProduct.name;
        u.price = matchedProduct.price;
        u.stock = matchedProduct.stock || 0;
        u.vatApplicable = matchedProduct.vatApplicable !== false;
        u.vatRate = typeof matchedProduct.vat === "number" ? matchedProduct.vat : 5;
      } else if (field === "name") {
        u.productId = "";
        u.stock = 0;
        u.vatApplicable = true;
        u.vatRate = 5;
      }

      const qty = Number(field === "quantity" ? value : u.quantity);
      const price = Number(field === "price" ? value : u.price);
      u.total = qty * price;

      const rateVal = u.vatApplicable !== false ? u.vatRate : 0;
      u.vat = u.total * (rateVal / 100);
      return u;
    }));
  };

  const addRow = () =>
    setProducts([...products, { id: Date.now(), productId: "", name: "", quantity: "", price: "", vat: 0, total: 0, vatApplicable: true, vatRate: 5, stock: 0 }]);

  const removeRow = (id) => {
    if (products.length > 1) setProducts(products.filter((p) => p.id !== id));
  };

  const getPaymentMethod = () => invoiceDetails.paymentMethod || "Cash";

  const resetForm = () => {
    setInvoiceDetails({
      invNo: "", date: new Date().toISOString().split("T")[0],
      customerName: "", location: "", contactNo: "",
      brandName: "", model: "", totalCntr: "", contract: "",
      customerTrn: "", dnNo: "", dnDate: "", srNo: "", srDate: "",
      lpoNo: "", lpoDate: "", note: "",
      paymentMethod: "Cash",
      discount: "", discountType: "flat"
    });
    setProducts([
      { id: Date.now(), productId: "", name: "", quantity: "", price: "", vat: 0, total: 0, vatApplicable: true, vatRate: 5, stock: 0 },
    ]);
    setMessage("");
    setSavedInvoice(null);
    setShowSavedModal(false);
  };

  const saveInvoice = async () => {
    if (isSaving) return;
    if (savedInvoice) {
      setMessage("Entry already saved");
      return;
    }
    setMessage("");

    const invoiceItems = products
      .filter((product) => product.name || product.quantity || product.price)
      .map((product) => ({
        productId: product.productId,
        qty: Number(product.quantity),
        rate: Number(product.price),
        stock: product.stock,
        name: product.name,
        vat: product.vat,
        total: product.total
      }));

    if (!invoiceItems.length) {
      setMessage("Add at least one product before saving.");
      return;
    }

    if (invoiceItems.some((item) => !Number.isFinite(item.qty) || item.qty <= 0)) {
      setMessage("Enter a valid quantity for every product.");
      return;
    }

    const stockErrors = products.filter(
      (p) => p.productId && Number(p.quantity) > (p.stock || 0)
    );
    if (stockErrors.length > 0) {
      setMessage(`Insufficient stock for: ${stockErrors.map((p) => `${p.name} (Stock: ${p.stock})`).join(", ")}. Please adjust quantities.`);
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onCreateInvoice({
        date: invoiceDetails.date,
        customer: {
          name: invoiceDetails.customerName,
          location: invoiceDetails.location,
          contact: invoiceDetails.contactNo,
          trn: invoiceDetails.customerTrn
        },
        discount: Number(invoiceDetails.discount) || 0,
        discountType: invoiceDetails.discountType,
        paymentMethod: getPaymentMethod(),
        items: invoiceItems,
        details: {
          brandName: invoiceDetails.brandName,
          model: invoiceDetails.model,
          totalCntr: invoiceDetails.totalCntr,
          contract: invoiceDetails.contract,
          dnNo: invoiceDetails.dnNo,
          dnDate: invoiceDetails.dnDate,
          srNo: invoiceDetails.srNo,
          srDate: invoiceDetails.srDate,
          lpoNo: invoiceDetails.lpoNo,
          lpoDate: invoiceDetails.lpoDate,
          note: invoiceDetails.note
        }
      });

      setInvoiceDetails((current) => ({
        ...current,
        invNo: saved.invoiceNumber || current.invNo
      }));
      setSavedInvoice(saved);
      setShowSavedModal(true);
      setMessage(`Saved ${saved.invoiceNumber}`);
      await onRefresh?.();
    } catch (err) {
      setMessage(err.message || "Could not save invoice.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPdf = async () => {
    try {
      setMessage("");
      const pdfDetails = await api.getPdfPath(savedInvoice.invoiceNumber);
      if (pdfDetails && pdfDetails.filePath) {
        if (window.electronAPI?.openPdf) {
          const err = await window.electronAPI.openPdf(pdfDetails.filePath);
          if (err) setMessage("PDF file not found.");
        } else {
          setMessage("PDF viewer only available in desktop app.");
        }
      } else {
        setMessage("PDF file not found for this invoice.");
      }
    } catch (err) {
      setMessage("Could not locate PDF file.");
    }
  };

  return (
    <div className="page-layout">
      <Sidebar />

      <div className="page-main">
        <div className="page-header">
          <div>
            <h2 className="page-title">Invoice Entry</h2>
            <p className="page-subtitle">Create and print tax invoices</p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn-secondary" onClick={resetForm}>
              <RotateCcw size={15} /> Reset Form
            </button>
            <button className="btn-primary" onClick={() => window.print()}>
              <Printer size={15} /> Print Invoice
            </button>
          </div>
        </div>

        {/* Customer info */}
        <div className="card entry-grid">
          <div className="form-group">
            <label>Invoice No. (Auto)</label>
            <input name="invNo" value={invoiceDetails.invNo} readOnly placeholder="Auto-generated" />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input type="date" name="date" value={invoiceDetails.date} onChange={handleInputChange} />
          </div>
          <div className="form-group">
            <label>
              Customer TRN 
              {invoiceDetails.customerTrn?.length === 15 && <span style={{ color: "#2a7d4f", fontSize: "11px", marginLeft: "6px" }}>(15/15 Max)</span>}
            </label>
            <input name="customerTrn" value={invoiceDetails.customerTrn} onChange={handleInputChange} maxLength={15} placeholder="Customer TRN (Max 15)" />
          </div>
          <div className="form-group span-3" style={{ position: "relative" }}>
            <label>Customer Name</label>
            <input
              name="customerName"
              value={invoiceDetails.customerName}
              onChange={handleCustomerNameChange}
              onFocus={() => setShowNameSuggestions(true)}
              onBlur={() => setTimeout(() => setShowNameSuggestions(false), 200)}
              placeholder="Start typing customer name to autocomplete..."
              autoComplete="off"
            />
            {showNameSuggestions && nameSuggestions.length > 0 && (
              <ul className="suggestions-dropdown" style={{ position: "absolute", zIndex: 10, width: "100%", background: "#fff", border: "1px solid #ccc" }}>
                {nameSuggestions.map((c, idx) => (
                  <li key={idx} onMouseDown={() => selectCustomer(c)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
                    <strong>{c.name}</strong>
                    <span className="suggestion-label" style={{ display: "block", fontSize: "11px", color: "#666" }}>Contact: {c.contact || "N/A"} | Location: {c.location || "N/A"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-group span-2">
            <label>Area / Location</label>
            <input name="location" value={invoiceDetails.location} onChange={handleInputChange} placeholder="Area / City" />
          </div>
          <div className="form-group" style={{ position: "relative" }}>
            <label>Contact No</label>
            <input
              name="contactNo"
              value={invoiceDetails.contactNo}
              onChange={handleCustomerContactChange}
              onFocus={() => setShowContactSuggestions(true)}
              onBlur={() => setTimeout(() => setShowContactSuggestions(false), 200)}
              placeholder="Phone"
              autoComplete="off"
            />
            {showContactSuggestions && contactSuggestions.length > 0 && (
              <ul className="suggestions-dropdown" style={{ position: "absolute", zIndex: 10, width: "100%", background: "#fff", border: "1px solid #ccc" }}>
                {contactSuggestions.map((c, idx) => (
                  <li key={idx} onMouseDown={() => selectCustomer(c)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
                    <strong>{c.contact}</strong>
                    <span className="suggestion-label" style={{ display: "block", fontSize: "11px", color: "#666" }}>Name: {c.name || "N/A"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="form-group">
            <label>Brand Name</label>
            <input name="brandName" value={invoiceDetails.brandName} onChange={handleInputChange} placeholder="Brand" />
          </div>
          <div className="form-group">
            <label>Model</label>
            <input name="model" value={invoiceDetails.model} onChange={handleInputChange} placeholder="Model" />
          </div>
          <div className="form-group">
            <label>Total Cntr</label>
            <input name="totalCntr" value={invoiceDetails.totalCntr} onChange={handleInputChange} placeholder="Counter" />
          </div>
          <div className="form-group span-3">
            <label>Contract</label>
            <input name="contract" value={invoiceDetails.contract} onChange={handleInputChange} placeholder="Contract details" />
          </div>
        </div>

        {/* Reference numbers */}
        <div className="card ref-entry-grid">
          <div className="form-group"><label>D.N No</label><input name="dnNo" value={invoiceDetails.dnNo} onChange={handleInputChange} placeholder="D.N No" /></div>
          <div className="form-group"><label>D.N Date</label><input type="date" name="dnDate" value={invoiceDetails.dnDate} onChange={handleInputChange} /></div>
          <div className="form-group"><label>S.R No</label><input name="srNo" value={invoiceDetails.srNo} onChange={handleInputChange} placeholder="S.R No" /></div>
          <div className="form-group"><label>S.R Date</label><input type="date" name="srDate" value={invoiceDetails.srDate} onChange={handleInputChange} /></div>
          <div className="form-group"><label>L.P.O No</label><input name="lpoNo" value={invoiceDetails.lpoNo} onChange={handleInputChange} placeholder="L.P.O No" /></div>
          <div className="form-group"><label>L.P.O Date</label><input type="date" name="lpoDate" value={invoiceDetails.lpoDate} onChange={handleInputChange} /></div>
        </div>

        {/* Products */}
        <div className="card">
          <h3 className="products-heading">Products — VAT 5% Auto Applied</h3>
          <div className="table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>#</th><th>Particulars</th><th>Qty</th>
                  <th>Stock</th><th>Rate (AED)</th><th>VAT 5%</th><th>Total</th><th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const hasStockErr = p.productId && Number(p.quantity) > p.stock;
                  return (
                    <tr key={p.id} style={{ background: hasStockErr ? "#ffeef0" : "transparent" }}>
                      <td className="row-num">{i + 1}</td>
                      <td style={{ position: "relative" }}>
                        <input
                          value={p.name}
                          onChange={(e) => updateProduct(p.id, "name", e.target.value)}
                          onFocus={() => setActiveProductRowId(p.id)}
                          onBlur={() => setTimeout(() => setActiveProductRowId(null), 200)}
                          placeholder="Item description"
                          style={{ minWidth: 120, width: "100%" }}
                          autoComplete="off"
                        />
                        {activeProductRowId === p.id && getProductSuggestions(p.name).length > 0 && (
                          <ul className="suggestions-dropdown" style={{ position: "absolute", zIndex: 10, width: "220px", background: "#fff", border: "1px solid #ccc" }}>
                            {getProductSuggestions(p.name).map((product) => (
                              <li key={product.id} onMouseDown={() => selectProduct(p.id, product)} style={{ padding: "8px", cursor: "pointer", borderBottom: "1px solid #eee" }}>
                                <strong>{product.name}</strong>
                                {product.sku && <span className="suggestion-label" style={{ display: "block", fontSize: "11px", color: "#666" }}>SKU: {product.sku}</span>}
                                <span className="suggestion-label" style={{ display: "block", fontSize: "11px", color: "#666" }}>Stock: {product.stock} | Price: AED {product.price}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                      <td>
                        <input type="number" min="1" value={p.quantity} onChange={(e) => updateProduct(p.id, "quantity", e.target.value)} placeholder="0" style={{ width: 60 }} />
                      </td>
                      <td style={{ fontWeight: 600, color: p.stock < 10 ? "#c00026" : "#2a7d4f", textAlign: "center" }}>
                        {p.productId ? p.stock : "—"}
                      </td>
                      <td>
                        <input type="number" min="0" value={p.price} onChange={(e) => updateProduct(p.id, "price", e.target.value)} placeholder="0.00" style={{ width: 80 }} />
                      </td>
                      <td className="calc-cell">{p.vat > 0 ? p.vat.toFixed(2) : "—"}</td>
                      <td className="calc-cell">{p.total > 0 ? p.total.toFixed(2) : "—"}</td>
                      <td>
                        <button onClick={() => removeRow(p.id)} className="btn-danger"><Trash2 size={13} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <button className="btn-secondary add-row-btn" onClick={addRow}>
            <Plus size={15} /> Add Item
          </button>
        </div>

        {/* Totals */}
        <div className="card totals-entry">
          <div className="note-group">
            <label>Note</label>
            <textarea name="note" value={invoiceDetails.note} onChange={handleInputChange} rows={3} placeholder="Any note for this invoice..." />
          </div>
          <div className="totals-summary">
            <div className="total-line"><span>Without VAT</span><span>AED {subTotal.toFixed(2)}</span></div>
            <div className="total-line pink"><span>VAT @ 5%</span><span>AED {totalVat.toFixed(2)}</span></div>
            <div className="total-line">
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>Discount</span>
                <select
                  name="discountType"
                  value={invoiceDetails.discountType}
                  onChange={handleInputChange}
                  style={{ border: "1px solid #ddd", borderRadius: "4px", padding: "2px 5px", fontSize: "12px" }}
                >
                  <option value="flat">AED</option>
                  <option value="percentage">%</option>
                </select>
              </div>
              <input type="number" name="discount" value={invoiceDetails.discount} onChange={handleInputChange} placeholder="0.00" className="discount-input" />
            </div>
            <div className="total-line pink bold"><span>G. Total</span><span>AED {grandTotal.toFixed(2)}</span></div>
          </div>
        </div>

        {/* Payment */}
        <div className="card payment-actions-row">
          <div className="payment-check-group" style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
            <span>Payment:</span>
            <label><input type="radio" name="paymentMethod" value="Cash" checked={(invoiceDetails.paymentMethod || "Cash") === "Cash"} onChange={handleInputChange} /> Cash</label>
            <label><input type="radio" name="paymentMethod" value="Cheque" checked={invoiceDetails.paymentMethod === "Cheque"} onChange={handleInputChange} /> Cheque</label>
            <label><input type="radio" name="paymentMethod" value="Card" checked={invoiceDetails.paymentMethod === "Card"} onChange={handleInputChange} /> Card</label>
            <label><input type="radio" name="paymentMethod" value="Bank Transfer" checked={invoiceDetails.paymentMethod === "Bank Transfer"} onChange={handleInputChange} /> Bank Transfer</label>
          </div>
          <div className="actions-group">
            <button className="btn-secondary" onClick={saveInvoice} disabled={isSaving}>
              <Save size={15} /> {isSaving ? "Saving..." : "Save Record"}
            </button>
            <button className="btn-primary" onClick={() => window.print()}><Printer size={15} /> Print A4</button>
          </div>
          {message && (
            <div style={{ width: "100%", color: (message.startsWith("Saved") || message.includes("already saved")) ? "#2a7d4f" : "#c00026", fontSize: 13, fontWeight: 600 }}>
              {message}
            </div>
          )}
        </div>
      </div>

      {/* ── PRINTABLE A4 — always rendered, hidden by CSS, shown only when printing ── */}
      <div className="printable-invoice">
        <div className="brand-strip">
          <img src="/brand.jpg" alt="brand" className="brand-strip-img" />
        </div>
        <div className="inv-body">
          <div className="inv-header">
            <div className="inv-logo-block">
              <img src="/logo.png" alt="logo" className="inv-logo" />
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
            <div className="trn-left">TRN: 100335760300003</div>
            <div className="trn-right">
              <span className="trn-label">Customer TRN:</span>
              <div className="trn-boxes">
                {Array.from({ length: 15 }).map((_, i) => (
                  <div className="trn-box" key={i}>{invoiceDetails.customerTrn?.[i] || ""}</div>
                ))}
              </div>
            </div>
          </div>
          <table className="info-table">
            <tbody>
              <tr>
                <td className="info-cell" colSpan={2}>Inv. No. : <strong>{invoiceDetails.invNo}</strong></td>
                <td className="info-cell">Date: <strong>{invoiceDetails.date}</strong></td>
              </tr>
              <tr><td className="info-cell customer-name-cell" colSpan={3}>Customer Name: <strong>{invoiceDetails.customerName}</strong></td></tr>
              <tr>
                <td className="info-cell" colSpan={2}>Area/Location: <strong>{invoiceDetails.location}</strong></td>
                <td className="info-cell">Contact No: <strong>{invoiceDetails.contactNo}</strong></td>
              </tr>
              <tr>
                <td className="info-cell">Brand Name: <strong>{invoiceDetails.brandName}</strong></td>
                <td className="info-cell">Model: <strong>{invoiceDetails.model}</strong></td>
                <td className="info-cell">Total Cntr: <strong>{invoiceDetails.totalCntr}</strong></td>
              </tr>
              <tr><td className="info-cell" colSpan={3}>Contract: <strong>{invoiceDetails.contract}</strong></td></tr>
            </tbody>
          </table>
          <hr className="black-separator" />
          <table className="ref-table">
            <tbody>
              <tr>
                <td className="ref-cell">D.N No: <strong>{invoiceDetails.dnNo}</strong></td>
                <td className="ref-cell">S.R No: <strong>{invoiceDetails.srNo}</strong></td>
                <td className="ref-cell">L.P.O No: <strong>{invoiceDetails.lpoNo}</strong></td>
              </tr>
              <tr>
                <td className="ref-cell">Date: <strong>{invoiceDetails.dnDate}</strong></td>
                <td className="ref-cell">Date: <strong>{invoiceDetails.srDate}</strong></td>
                <td className="ref-cell">Date: <strong>{invoiceDetails.lpoDate}</strong></td>
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
                <th className="col-vat"><div>الضريبة</div><div>VAT(5%)</div></th>
                <th className="col-total"><div>المبلغ الاجمالي</div><div>Total Amount</div></th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.id}>
                  <td className="col-no">{i + 1}</td>
                  <td className="col-particulars text-left">{p.name}</td>
                  <td className="col-qty">{p.quantity}</td>
                  <td className="col-rate">{p.price ? Number(p.price).toFixed(2) : ""}</td>
                  <td className="col-vat">{p.vat > 0 ? p.vat.toFixed(2) : ""}</td>
                  <td className="col-total">{p.total > 0 ? p.total.toFixed(2) : ""}</td>
                </tr>
              ))}
              {Array.from({ length: Math.max(0, EMPTY_ROWS - products.length) }).map((_, i) => (
                <tr key={`e-${i}`} className="empty-row">
                  <td /><td /><td /><td /><td /><td className="col-total" />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="footer-note" colSpan={3} rowSpan={3}>Note: {invoiceDetails.note}</td>
                <td className="footer-label footer-pink" colSpan={2}>Without VAT</td>
                <td className="footer-value footer-pink">{subTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="footer-label footer-pink" colSpan={2}>VAT @5%</td>
                <td className="footer-value footer-pink">{totalVat.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="footer-label footer-pink" colSpan={2}>Discount</td>
                <td className="footer-value footer-pink">
                  {invoiceDetails.discountType === "percentage"
                    ? `${invoiceDetails.discount}% (AED ${(subTotal * (Number(invoiceDetails.discount) / 100)).toFixed(2)})`
                    : invoiceDetails.discount ? Number(invoiceDetails.discount).toFixed(2) : ""
                  }
                </td>
              </tr>
              <tr>
                <td className="footer-total-dhs" colSpan={3}>Total Dhs. <strong>{grandTotal.toFixed(2)}</strong></td>
                <td className="footer-label footer-pink" colSpan={2}>G. total</td>
                <td className="footer-value footer-pink"><strong>{grandTotal.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
          <div className="payment-row">
            <span className="payment-desc-label">Payment Description</span>
            <span className="payment-opt">Cash: <span className="checkbox-box">{(invoiceDetails.paymentMethod || "Cash") === "Cash" ? "✓" : ""}</span></span>
            <span className="payment-opt">Cheque: <span className="checkbox-box">{invoiceDetails.paymentMethod === "Cheque" ? "✓" : ""}</span></span>
            <span className="payment-opt">Card: <span className="checkbox-box">{invoiceDetails.paymentMethod === "Card" ? "✓" : ""}</span></span>
            <span className="payment-opt">Bank Transfer: <span className="checkbox-box">{invoiceDetails.paymentMethod === "Bank Transfer" ? "✓" : ""}</span></span>
          </div>
          <div className="signature-row" style={{ marginTop: "15mm" }}>
            <span>Customer Signature:</span>
            <span>For Image Office Solutions</span>
          </div>
        </div>
      </div>

      {/* ── SAVED INVOICE SUCCESS MODAL ── */}
      {showSavedModal && savedInvoice && (
        <div className="modal-overlay print-modal-overlay" onClick={() => setShowSavedModal(false)}>
          <div className="modal-content-wrapper" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "480px" }}>
            <div className="modal-header">
              <h3>Invoice Saved</h3>
              <button className="modal-close-btn" onClick={() => setShowSavedModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: "40px 24px", background: "#fff", textAlign: "center" }}>
              <div style={{ background: "#e6f6ec", width: "70px", height: "70px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#2a7d4f" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <h2 style={{ color: "#2a7d4f", marginBottom: "8px", fontSize: "22px", fontWeight: 700 }}>Saved Successfully!</h2>
              <p style={{ fontSize: "15px", color: "#555", marginBottom: "4px" }}>
                Invoice: <strong style={{ color: "#c00026", fontSize: "18px" }}>{savedInvoice.invoiceNumber}</strong>
              </p>
              <p style={{ fontSize: "13px", color: "#999", marginBottom: 0 }}>Click Print Invoice to print the invoice.</p>
              {message && (
                <div style={{ color: message.includes("not found") ? "#c00026" : "#2a7d4f", fontSize: 13, fontWeight: 600, marginTop: "12px" }}>
                  {message}
                </div>
              )}
            </div>
            <div className="modal-footer-actions" style={{ justifyContent: "center", paddingBottom: "28px", borderTop: "none", background: "#fff", display: "flex", gap: "10px" }}>
              <button className="btn-secondary" onClick={() => setShowSavedModal(false)} style={{ padding: "11px 20px" }}>
                Dismiss
              </button>
              <button className="btn-primary" onClick={() => { setShowSavedModal(false); window.print(); }} style={{ padding: "11px 24px", display: "flex", alignItems: "center", gap: "8px" }}>
                <Printer size={16} /> Print Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
