import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { clearSession, createApi, login, readSession, saveSession } from "./api/client";
import Dashboard from "./pages/dashboard";
import DailyReport from "./pages/dailyReport";
import Login from "./pages/login";
import MonthlyReport from "./pages/monthlyReport";
import StaffDashboard from "./pages/staffdashboard";
import ProductManagement from "./pages/productManagement";
import InvoicesHistory from "./pages/invoicesHistory";

const ProtectedRoute = ({ children, session, allowedRoles }) => {
  if (!session?.token) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(session.user?.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
};

const Unauthorized = () => (
  <div className="unauthorized-page">
    <div className="unauthorized-card">
      <div className="unauthorized-icon">!</div>
      <h2>Access Denied</h2>
      <p>You don't have permission to view this page.</p>
      <button
        onClick={() => {
          const role = localStorage.getItem("userRole");
          window.location.href = role === "admin" ? "/dashboard" : "/invoice";
        }}
      >
        Go Back
      </button>
    </div>
  </div>
);

function App() {
  const [session, setSession] = useState(readSession);
  const [products, setProducts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const api = useMemo(() => createApi(session), [session]);

  const loadData = useCallback(async () => {
    if (!session?.token) return;

    setLoading(true);
    setError("");

    try {
      // Products power invoice item lookup; invoices power dashboard and reports.
      const [productData, invoiceData] = await Promise.all([
        api.getProducts(),
        api.getInvoices()
      ]);
      setProducts(productData);
      setInvoices(invoiceData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [api, session]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const syncLogout = () => {
      clearSession();
      setSession(null);
      setProducts([]);
      setInvoices([]);
    };

    window.addEventListener("pos-session-cleared", syncLogout);
    return () => window.removeEventListener("pos-session-cleared", syncLogout);
  }, []);

  const handleLogin = async (form) => {
    const sessionData = await login(form);
    saveSession(sessionData);
    setSession(sessionData);
  };

  const createInvoice = async (payload) => {
    setError("");
    const invoice = await api.createInvoice(payload);
    await loadData();
    return invoice;
  };

  return (
    <BrowserRouter>
      {error && <div className="app-error">{error}</div>}
      {loading && <div className="loading-bar">Loading...</div>}
      <Routes>
        <Route
          path="/"
          element={session?.token ? (
            // Staff Module (Temporarily Disabled)
            // TODO: Re-enable if Staff functionality is needed in the future.
            // <Navigate to={session.user?.role === "admin" ? "/dashboard" : "/invoice"} replace />
            <Navigate to="/dashboard" replace />
          ) : (
            <Login onLogin={handleLogin} />
          )}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <Dashboard products={products} invoices={invoices} api={api} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <ProductManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/daily-report"
          element={
            // Staff Module (Temporarily Disabled)
            // <ProtectedRoute session={session} allowedRoles={["admin", "staff"]}>
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <DailyReport invoices={invoices} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monthly-report"
          element={
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <MonthlyReport invoices={invoices} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoice"
          element={
            // Staff Module (Temporarily Disabled)
            // <ProtectedRoute session={session} allowedRoles={["staff"]}>
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <StaffDashboard productsCatalog={products} onCreateInvoice={createInvoice} onRefresh={loadData} invoices={invoices} api={api} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/invoices"
          element={
            // Staff Module (Temporarily Disabled)
            // <ProtectedRoute session={session} allowedRoles={["admin", "staff"]}>
            <ProtectedRoute session={session} allowedRoles={["admin"]}>
              <InvoicesHistory invoices={invoices} onRefresh={loadData} api={api} />
            </ProtectedRoute>
          }
        />

        <Route path="/unauthorized" element={<Unauthorized />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
