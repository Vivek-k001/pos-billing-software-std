const { db } = require("../config/db");

// Helper to format SQLite product row to the object structure expected by frontend
const formatProduct = (p) => {
  if (!p) return null;
  return {
    ...p,
    vatApplicable: Boolean(p.vatApplicable)
  };
};

// CREATE PRODUCT
exports.createProduct = async (req, res) => {
  try {
    const {
      name,
      sku = "",
      price,
      stock = 0,
      vat = 5,
      vatApplicable = true,
      category = "General",
      serialNumber = "",
      warrantyMonths = 0,
      maxStock
    } = req.body;

    if (!name || price == null) {
      return res.status(400).json({ message: "Name and price are required" });
    }

    if (Number(price) < 0 || Number(stock) < 0 || Number(warrantyMonths) < 0) {
      return res.status(400).json({ message: "Invalid price, stock, or warranty" });
    }

    const finalMaxStock = maxStock !== undefined ? Number(maxStock) : Number(stock);

    if (finalMaxStock > 0 && Number(stock) > finalMaxStock) {
      return res.status(400).json({ message: "Current stock cannot exceed max stock capacity" });
    }

    const info = db.prepare(`
      INSERT INTO products (name, sku, price, stock, maxStock, vat, vatApplicable, category, serialNumber, warrantyMonths)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      name,
      sku,
      Number(price),
      Number(stock),
      finalMaxStock,
      Number(vat),
      vatApplicable ? 1 : 0,
      category,
      serialNumber,
      Number(warrantyMonths)
    );

    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(info.lastInsertRowid);
    res.status(201).json(formatProduct(product));

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET ALL PRODUCTS
exports.getProducts = async (req, res) => {
  try {
    const { limit, page } = req.query;

    if (!limit || !page) {
      // Backward compatibility: return all as an array if no pagination requested
      const products = db.prepare("SELECT * FROM products ORDER BY createdAt DESC").all();
      return res.json(products.map(formatProduct));
    }

    const limitNum = parseInt(limit, 10) || 50;
    const pageNum = parseInt(page, 10) || 1;
    const offset = (pageNum - 1) * limitNum;

    const products = db.prepare("SELECT * FROM products ORDER BY createdAt DESC LIMIT ? OFFSET ?").all(limitNum, offset);
    const totalCountRow = db.prepare("SELECT count(*) as count FROM products").get();

    res.json({
      data: products.map(formatProduct),
      total: totalCountRow.count,
      page: pageNum,
      limit: limitNum
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// GET SINGLE PRODUCT
exports.getSingleProduct = async (req, res) => {
  try {
    const product = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(formatProduct(product));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// UPDATE PRODUCT
exports.updateProduct = async (req, res) => {
  try {
    const existing = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    if (!existing) {
      return res.status(404).json({ message: "Product not found" });
    }

    if (req.body.price != null && Number(req.body.price) < 0) {
      return res.status(400).json({ message: "Invalid price" });
    }

    if (req.body.stock != null && Number(req.body.stock) < 0) {
      return res.status(400).json({ message: "Invalid stock" });
    }

    if (req.body.maxStock != null && Number(req.body.maxStock) < 0) {
      return res.status(400).json({ message: "Invalid max stock" });
    }

    if (req.body.warrantyMonths != null && Number(req.body.warrantyMonths) < 0) {
      return res.status(400).json({ message: "Invalid warranty period" });
    }

    const name = req.body.name !== undefined ? req.body.name : existing.name;
    const sku = req.body.sku !== undefined ? req.body.sku : existing.sku;
    const price = req.body.price !== undefined ? Number(req.body.price) : existing.price;
    const stock = req.body.stock !== undefined ? Number(req.body.stock) : existing.stock;
    const maxStock = req.body.maxStock !== undefined ? Number(req.body.maxStock) : existing.maxStock;

    if (maxStock > 0 && stock > maxStock) {
      return res.status(400).json({ message: "Current stock cannot exceed max stock capacity" });
    }

    const vat = req.body.vat !== undefined ? Number(req.body.vat) : existing.vat;
    const vatApplicable = req.body.vatApplicable !== undefined ? (req.body.vatApplicable ? 1 : 0) : existing.vatApplicable;
    const category = req.body.category !== undefined ? req.body.category : existing.category;
    const serialNumber = req.body.serialNumber !== undefined ? req.body.serialNumber : existing.serialNumber;
    const warrantyMonths = req.body.warrantyMonths !== undefined ? Number(req.body.warrantyMonths) : existing.warrantyMonths;

    db.prepare(`
      UPDATE products
      SET name = ?, sku = ?, price = ?, stock = ?, maxStock = ?, vat = ?, vatApplicable = ?, category = ?, serialNumber = ?, warrantyMonths = ?, updatedAt = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name, sku, price, stock, maxStock, vat, vatApplicable, category, serialNumber, warrantyMonths, req.params.id);

    const updated = db.prepare("SELECT * FROM products WHERE id = ?").get(req.params.id);
    res.json(formatProduct(updated));

  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// DELETE PRODUCT
exports.deleteProduct = async (req, res) => {
  try {
    const result = db.prepare("DELETE FROM products WHERE id = ?").run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
