import React, { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/sidebar";
import { createApi, readSession } from "../api/client";
import "./productManagement.css";
import { Plus, Edit2, Trash2, X, Search, Package, AlertTriangle, XCircle, Wallet } from "lucide-react";

const ProductManagement = () => {
  const session = readSession();
  const api = useMemo(() => (session ? createApi(session) : null), [session?.token]);
  
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    category: "",
    price: "",
    stock: "0",
    maxStock: "0",
    vat: "5"
  });

  const timeAgo = (dateValue) => {
    if (!dateValue) return "Just now";
    
    let parsedString = dateValue;
    if (typeof dateValue === "string" && !dateValue.includes("Z") && !dateValue.includes("T")) {
      // SQLite CURRENT_TIMESTAMP returns "YYYY-MM-DD HH:MM:SS" in UTC.
      // We must append "Z" so the browser parses it as UTC time, not local time.
      parsedString = dateValue.replace(" ", "T") + "Z";
    }

    let d = new Date(parsedString);
    if (isNaN(d.getTime())) return "Unknown";

    const seconds = Math.floor((new Date() - d) / 1000);
    // If it's a tiny bit negative due to clock skew, say Just now
    if (seconds < 5) return "Just now";
    
    let interval = seconds / 31536000;
    if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " yr ago" : " yrs ago");
    interval = seconds / 2592000;
    if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " mo ago" : " mos ago");
    interval = seconds / 86400;
    if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " day ago" : " days ago");
    interval = seconds / 3600;
    if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " hr ago" : " hrs ago");
    interval = seconds / 60;
    if (interval >= 1) return Math.floor(interval) + (Math.floor(interval) === 1 ? " min ago" : " mins ago");
    return "Just now";
  };

  // Derived Stats
  const stats = useMemo(() => {
    let total = products.length;
    let lowStock = 0;
    let outOfStock = 0;
    let inventoryValue = 0;

    products.forEach(p => {
      const s = p.stock || 0;
      if (s === 0) outOfStock++;
      else if (s < 10) lowStock++;
      inventoryValue += s * (parseFloat(p.price) || 0);
    });

    return { total, lowStock, outOfStock, inventoryValue };
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    if (!searchTerm) return products;
    const lowerSearch = searchTerm.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(lowerSearch) || 
      (p.sku && p.sku.toLowerCase().includes(lowerSearch))
    );
  }, [products, searchTerm]);

  // Unique Categories for suggestions
  const uniqueCategories = useMemo(() => {
    const categories = new Set();
    products.forEach(p => {
      if (p.category) {
        categories.add(p.category);
      }
    });
    return Array.from(categories).sort();
  }, [products]);

  const categorySuggestions = useMemo(() => {
    const query = formData.category.trim().toLowerCase();
    if (!query) return uniqueCategories;
    return uniqueCategories.filter((c) => c.toLowerCase().includes(query));
  }, [uniqueCategories, formData.category]);

  const selectCategory = (categoryName) => {
    setFormData((prev) => ({ ...prev, category: categoryName }));
    setShowCategorySuggestions(false);
  };

  // Load products
  const loadProducts = async () => {
    if (!api) return;
    setLoading(true);
    setError("");
    try {
      const data = await api.getProducts();
      setProducts(data);
    } catch (err) {
      setError(err.message || "Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  // Handle form input
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle save (create or update)
  const handleSave = async (e) => {
    e.preventDefault();
    if (!api) return;

    const { name, sku, category, price, stock, maxStock, vat } = formData;
    if (!name || !sku || !category || !price) {
      setError("All required fields must be filled");
      return;
    }

    const parsedStock = parseInt(stock) || 0;
    const parsedMax = parseInt(maxStock) || 0;
    
    // Only check if maxStock was explicitly set to a value > 0
    if (parsedMax > 0 && parsedStock > parsedMax) {
      setError("Current stock cannot exceed max stock capacity.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const payload = {
        name,
        sku,
        category,
        price: parseFloat(price),
        stock: parsedStock,
        maxStock: parsedMax || parsedStock,
        vat: parseFloat(vat)
      };

      if (editingId) {
        // Update
        await api.updateProduct(editingId, payload);
      } else {
        // Create
        await api.createProduct(payload);
      }
      resetForm();
      setShowModal(false);
      await loadProducts();
    } catch (err) {
      setError(err.message || "Failed to save product");
    } finally {
      setLoading(false);
    }
  };

  // Handle edit
  const handleEdit = (product) => {
    setFormData({
      name: product.name,
      sku: product.sku,
      category: product.category,
      price: product.price,
      stock: product.stock || 0,
      maxStock: product.maxStock || product.stock || 0,
      vat: product.vat || "5"
    });
    setEditingId(product.id);
    setShowModal(true);
  };

  // Handle delete
  const handleDelete = async (id) => {
    if (!api) return;
    setLoading(true);
    setError("");
    try {
      await api.deleteProduct(id);
      setDeleteConfirm(null);
      await loadProducts();
    } catch (err) {
      setError(err.message || "Failed to delete product");
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({ name: "", sku: "", category: "", price: "", stock: "0", maxStock: "0", vat: "5" });
    setEditingId(null);
    setError("");
  };

  // Open add modal
  const handleAddNew = () => {
    resetForm();
    setShowModal(true);
  };
  
  // Render stock bar indicator
  const renderStockBar = (stock, maxStock) => {
    const s = stock || 0;
    const m = maxStock && maxStock > 0 ? maxStock : (s > 10 ? s : 10); // default to 10 if not set or just for visual
    
    let colorClass = "stock-bar-green";
    let statusId = "In Stock";
    let percentage = Math.min((s / m) * 100, 100);
    
    if (s === 0) {
      colorClass = "stock-bar-red";
      percentage = 5; // tiny blip
      statusId = "Out of Stock";
    } else {
      // If maxStock is set, use 75% threshold (as requested, e.g., 7/10 is yellow). Otherwise, use absolute < 10 fallback.
      const isLowStock = maxStock && maxStock > 0 ? (s <= maxStock * 0.75) : (s < 10);
      if (isLowStock) {
        colorClass = "stock-bar-yellow";
        statusId = "Low Stock";
      }
    }

    // Display string: e.g. "9/10" if maxStock is set, else just "9"
    const displayText = maxStock && maxStock > 0 ? `${s}/${maxStock}` : `${s}`;

    return (
      <div className="stock-indicator-wrapper">
        <div className="stock-count-text">
          <span className="current-stock">{displayText}</span>
          <span className="stock-status-label">{statusId}</span>
        </div>
        <div className="stock-bar-bg">
          <div className={`stock-bar-fill ${colorClass}`} style={{ width: `${percentage}%` }}></div>
        </div>
      </div>
    );
  };

  return (
    <div className="page-layout">
      <Sidebar />
      <div className="page-main">
        <div className="page-header slim-header">
          <div>
            <h2 className="page-title">Product Management</h2>
            <p className="page-subtitle">Track and manage your inventory</p>
          </div>
          <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
            <div className="search-box" style={{ width: "260px" }}>
              <Search className="search-icon" size={18} />
              <input 
                type="text" 
                placeholder="Search products or SKU..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <button className="add-btn premium-btn" onClick={handleAddNew}>
              <Plus size={18} /> Add Product
            </button>
          </div>
        </div>

        {error && (
          <div className="error-banner animate-fade-in">
            <span>{error}</span>
            <button onClick={() => setError("")}><X size={16} /></button>
          </div>
        )}

        {/* 4 KPI Boxes */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ background: "#fef0f4", color: "#c00026" }}>
              <Package size={22} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Total Products</span>
              <span className="kpi-value">{stats.total}</span>
              <span className="kpi-sub">All active products</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ background: "#fff9e6", color: "#e6a23c" }}>
              <AlertTriangle size={22} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Low Stock</span>
              <span className="kpi-value">{stats.lowStock}</span>
              <span className="kpi-sub">Need restocking</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ background: "#fdeced", color: "#e02424" }}>
              <XCircle size={22} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Out of Stock</span>
              <span className="kpi-value">{stats.outOfStock}</span>
              <span className="kpi-sub">Currently unavailable</span>
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-icon-wrapper" style={{ background: "#ebf5f0", color: "#2a7d4f" }}>
              <Wallet size={22} />
            </div>
            <div className="kpi-info">
              <span className="kpi-label">Inventory Value</span>
              <span className="kpi-value">AED {stats.inventoryValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span className="kpi-sub">Total stock value</span>
            </div>
          </div>
        </div>

        {loading && <div className="loading-bar">Loading...</div>}

        <div className="card glass-card">
          <div className="table-scroll">
            <table className="products-table premium-table">
              <thead>
                <tr>
                  <th>Product Name</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Price (AED)</th>
                  <th style={{ width: "160px" }}>Status</th>
                  <th>Updated</th>
                  <th>VAT (%)</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                      {searchTerm ? "No products found matching your search." : "No products yet. Click 'Add Product' to create one."}
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(product => (
                    <tr key={product.id} className="table-row-hover">
                      <td style={{ fontWeight: 600, color: "#111" }}>{product.name}</td>
                      <td><span className="sku-badge">{product.sku}</span></td>
                      <td>{product.category}</td>
                      <td style={{ fontWeight: 500 }}>{parseFloat(product.price).toFixed(2)}</td>
                      <td>
                        {renderStockBar(product.stock, product.maxStock)}
                      </td>
                      <td style={{ color: "#777", fontSize: "13px" }}>{timeAgo(product.updatedAt)}</td>
                      <td>{product.vat || 5}%</td>
                      <td className="text-right">
                        <div className="action-buttons-overlay">
                          <button 
                            className="action-btn edit-btn"
                            onClick={() => handleEdit(product)}
                            title="Edit product">
                            <Edit2 size={16} />
                          </button>
                          <button 
                            className="action-btn delete-btn"
                            onClick={() => setDeleteConfirm(product.id)}
                            title="Delete product">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !loading && setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingId ? "Edit Product" : "Add New Product"}</h3>
              <button className="modal-close" onClick={() => !loading && setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            {error && (
              <div className="error-banner animate-fade-in" style={{ margin: "20px 20px 0 20px" }}>
                <span>{error}</span>
                <button type="button" onClick={() => setError("")}><X size={16} /></button>
              </div>
            )}

            <form onSubmit={handleSave} className="modal-form">
              <div className="form-group">
                <label htmlFor="name">Product Name *</label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  placeholder="e.g., Laptop, Keyboard"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="sku">SKU *</label>
                <input
                  id="sku"
                  type="text"
                  name="sku"
                  placeholder="e.g., LAP-001"
                  value={formData.sku}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div className="form-group" style={{ position: "relative" }}>
                <label htmlFor="category">Category *</label>
                <input
                  id="category"
                  type="text"
                  name="category"
                  placeholder="e.g., Electronics"
                  value={formData.category}
                  onChange={handleInputChange}
                  onFocus={() => setShowCategorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowCategorySuggestions(false), 200)}
                  autoComplete="off"
                  required
                />
                {showCategorySuggestions && categorySuggestions.length > 0 && (
                  <ul className="suggestions-dropdown" style={{ position: "absolute", zIndex: 10, width: "100%", background: "#fff", border: "1px solid #ccc", top: "100%", left: 0, marginTop: "4px", borderRadius: "6px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", listStyle: "none", padding: 0, maxHeight: "200px", overflowY: "auto" }}>
                    {categorySuggestions.map((cat, idx) => (
                      <li key={idx} onMouseDown={() => selectCategory(cat)} style={{ padding: "10px 12px", cursor: "pointer", borderBottom: idx < categorySuggestions.length - 1 ? "1px solid #eee" : "none", color: "#333", fontSize: "14px" }} className="suggestion-item">
                        {cat}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="price">Price (AED) *</label>
                  <input
                    id="price"
                    type="number"
                    name="price"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="vat">VAT (%)</label>
                  <input
                    id="vat"
                    type="number"
                    name="vat"
                    placeholder="5"
                    step="0.1"
                    min="0"
                    max="100"
                    value={formData.vat}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="stock">Current Stock</label>
                  <input
                    id="stock"
                    type="number"
                    name="stock"
                    placeholder="0"
                    step="1"
                    min="0"
                    value={formData.stock}
                    onChange={handleInputChange}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="maxStock">Max Stock Capacity</label>
                  <input
                    id="maxStock"
                    type="number"
                    name="maxStock"
                    placeholder="0"
                    step="1"
                    min="0"
                    value={formData.maxStock}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={loading}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={loading}>
                  {loading ? "Saving..." : editingId ? "Update Product" : "Add Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Product</h3>
            </div>
            <p className="confirm-text">Are you sure you want to delete this product? This action cannot be undone.</p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={loading}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => handleDelete(deleteConfirm)}
                disabled={loading}>
                {loading ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductManagement;
