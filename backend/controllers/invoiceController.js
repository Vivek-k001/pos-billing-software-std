const { db } = require("../config/db");
const { calculateInvoice } = require("../utils/calc");
const fs = require("fs");
const path = require("path");

const addMonths = (date, months) => {
  const warrantyUntil = new Date(date);
  warrantyUntil.setMonth(warrantyUntil.getMonth() + months);
  return warrantyUntil;
};

// Helper to format SQLite invoice and items into nested objects expected by frontend
const formatInvoice = (inv, items = []) => {
  if (!inv) return null;
  return {
    id: String(inv.id),
    invoiceNumber: inv.invoiceNumber,
    date: inv.date,
    customer: {
      name: inv.customerName || "",
      location: inv.customerLocation || "",
      contact: inv.customerContact || "",
      trn: inv.customerTrn || ""
    },
    items: items.map(item => ({
      id: String(item.id),
      productId: item.productId,
      name: item.name,
      qty: item.qty,
      rate: item.rate,
      serialNumber: item.serialNumber || "",
      warrantyMonths: item.warrantyMonths || 0,
      warrantyUntil: item.warrantyUntil || null,
      vat: item.vat,
      total: item.total
    })),
    subtotal: inv.subtotal,
    vatTotal: inv.vatTotal,
    discount: inv.discount,
    discountType: inv.discountType,
    grandTotal: inv.grandTotal,
    paymentMethod: inv.paymentMethod,
    status: inv.status,
    details: {
      brandName: inv.detailsBrandName || "",
      model: inv.detailsModel || "",
      totalCntr: inv.detailsTotalCntr || "",
      contract: inv.detailsContract || "",
      dnNo: inv.detailsDnNo || "",
      dnDate: inv.detailsDnDate || "",
      srNo: inv.detailsSrNo || "",
      srDate: inv.detailsSrDate || "",
      lpoNo: inv.detailsLpoNo || "",
      lpoDate: inv.detailsLpoDate || "",
      note: inv.detailsNote || ""
    },
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt
  };
};

exports.createInvoice = async (req, res) => {
  // Run all database operations in a transaction
  const transaction = db.transaction(() => {
    const { items = [], customer = {}, discount = 0, discountType = "flat", paymentMethod = "Cash", details = {} } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("At least one invoice item is required");
    }

    const invoiceItems = [];
    const invoiceDate = new Date().toISOString();

    for (const item of items) {
      // Products in SQLite are identified by integer primary keys
      const productId = Number(item.productId);
      const product = db.prepare("SELECT * FROM products WHERE id = ?").get(productId);
      const qty = Number(item.qty);

      if (!product) {
        throw new Error("Product not found");
      }

      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Invalid quantity for ${product.name}`);
      }

      if (product.stock < qty) {
        throw new Error(`Insufficient stock for ${product.name}`);
      }

      invoiceItems.push({
        productId: String(product.id),
        name: product.name,
        qty,
        rate: product.price,
        serialNumber: product.serialNumber || "",
        warrantyMonths: Number(product.warrantyMonths) || 0,
        warrantyUntil: product.warrantyMonths ? addMonths(new Date(invoiceDate), Number(product.warrantyMonths)).toISOString().split('T')[0] : null,
        vatApplicable: Boolean(product.vatApplicable),
        vatRate: typeof product.vat === "number" ? product.vat : 5
      });
    }

    const calc = calculateInvoice(invoiceItems, Number(discount) || 0, discountType);

    // 1. Decrement product stocks
    const updateStock = db.prepare("UPDATE products SET stock = stock - ? WHERE id = ?");
    for (const item of invoiceItems) {
      updateStock.run(item.qty, Number(item.productId));
    }

    // 2. Insert Invoice
    const insertInvoice = db.prepare(`
      INSERT INTO invoices (
        invoiceNumber, date, customerName, customerLocation, customerContact, customerTrn,
        subtotal, vatTotal, discount, discountType, grandTotal, paymentMethod, status,
        detailsBrandName, detailsModel, detailsTotalCntr, detailsContract, detailsDnNo, detailsDnDate,
        detailsSrNo, detailsSrDate, detailsLpoNo, detailsLpoDate, detailsNote
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const invoiceNumber = "INV-" + Date.now();
    const info = insertInvoice.run(
      invoiceNumber,
      invoiceDate,
      customer.name || "",
      customer.location || "",
      customer.contact || "",
      customer.trn || "",
      calc.subtotal,
      calc.vatTotal,
      calc.discount,
      calc.discountType,
      calc.grandTotal,
      paymentMethod,
      "Active",
      details.brandName || "",
      details.model || "",
      details.totalCntr || "",
      details.contract || "",
      details.dnNo || "",
      details.dnDate || "",
      details.srNo || "",
      details.srDate || "",
      details.lpoNo || "",
      details.lpoDate || "",
      details.note || ""
    );

    const invoiceId = info.lastInsertRowid;

    // 3. Insert Invoice Items
    const insertItem = db.prepare(`
      INSERT INTO invoice_items (
        invoiceId, productId, name, qty, rate, serialNumber, warrantyMonths, warrantyUntil, vat, total
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of calc.items) {
      insertItem.run(
        invoiceId,
        item.productId,
        item.name,
        item.qty,
        item.rate,
        item.serialNumber,
        item.warrantyMonths,
        item.warrantyUntil,
        item.vat,
        item.total
      );
    }

    const invRow = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    const itemRows = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?").all(invoiceId);
    return formatInvoice(invRow, itemRows);
  });

  try {
    const invoice = transaction();


    // In parallel, seed the helper customer directory if it doesn't already contain this customer name
    try {
      const custName = req.body.customer?.name;
      if (custName) {
        const existingCust = db.prepare("SELECT * FROM customers WHERE name = ?").get(custName);
        if (!existingCust) {
          db.prepare("INSERT INTO customers (name, location, contact, trn) VALUES (?, ?, ?, ?)")
            .run(custName, req.body.customer?.location || "", req.body.customer?.contact || "", req.body.customer?.trn || "");
        }
      }
    } catch (custErr) {
      console.error("Failed to seed customer directory:", custErr);
    }

    res.status(201).json(invoice);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getInvoices = async (req, res) => {
  try {
    const invoices = db.prepare("SELECT * FROM invoices ORDER BY date DESC").all();
    const formattedInvoices = invoices.map(inv => {
      const items = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?").all(inv.id);
      return formatInvoice(inv, items);
    });
    res.json(formattedInvoices);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.voidInvoice = async (req, res) => {
  const transaction = db.transaction(() => {
    const { id } = req.params;
    const invoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(Number(id));

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "Voided") {
      throw new Error("Invoice is already voided");
    }

    const items = db.prepare("SELECT * FROM invoice_items WHERE invoiceId = ?").all(invoice.id);

    // Restore stock for all items
    const restoreStock = db.prepare("UPDATE products SET stock = stock + ? WHERE id = ?");
    for (const item of items) {
      if (item.productId) {
        restoreStock.run(item.qty, Number(item.productId));
      }
    }

    // Set status to voided
    db.prepare("UPDATE invoices SET status = 'Voided', updatedAt = CURRENT_TIMESTAMP WHERE id = ?").run(invoice.id);

    const updatedInvoice = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoice.id);
    return formatInvoice(updatedInvoice, items);
  });

  try {
    const invoice = transaction();
    res.json({ message: "Invoice voided successfully", invoice });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.getPdfHistory = async (req, res) => {
  try {
    const historyPath = path.join(__dirname, "..", "..", "Invoice History");
    if (!fs.existsSync(historyPath)) {
      return res.json([]);
    }

    const files = fs.readdirSync(historyPath);
    const pdfs = files.filter(f => f.toLowerCase().endsWith(".pdf"));

    const history = [];
    for (const file of pdfs) {
      const filePath = path.join(historyPath, file);
      const stat = fs.statSync(filePath);
      
      let invoiceNumber = null;
      let customerName = "Unknown";
      
      const match = file.match(/INV-\d+/i);
      if (match) {
        invoiceNumber = match[0].toUpperCase();
        try {
          const inv = db.prepare("SELECT * FROM invoices WHERE invoiceNumber = ?").get(invoiceNumber);
          if (inv) {
            customerName = inv.customerName || "Cash Customer";
          }
        } catch (dbErr) {
          console.error("DB error looking up invoice for PDF:", dbErr);
        }
      }

      history.push({
        id: file, // Use filename as unique id
        fileName: file,
        filePath: filePath,
        invoiceNumber: invoiceNumber || "N/A",
        customerName: customerName,
        createdAt: stat.mtime
      });
    }

    history.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json(history);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/invoices/pdf-path/:invoiceNumber
 * Returns the absolute filesystem path for the PDF of a given invoice number.
 * Returns 404 with { exists: false } if the file is not found.
 */
exports.getPdfPath = (req, res) => {
  try {
    const { invoiceNumber } = req.params;
    const historyPath = path.join(__dirname, "..", "..", "Invoice History");
    const filePath = path.join(historyPath, `${invoiceNumber}.pdf`);

    if (fs.existsSync(filePath)) {
      return res.json({ exists: true, filePath });
    }

    // Also try case-insensitive search for safety
    if (fs.existsSync(historyPath)) {
      const files = fs.readdirSync(historyPath);
      const match = files.find(
        (f) => f.toLowerCase() === `${invoiceNumber.toLowerCase()}.pdf`
      );
      if (match) {
        return res.json({ exists: true, filePath: path.join(historyPath, match) });
      }
    }

    return res.json({ exists: false, filePath: null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
