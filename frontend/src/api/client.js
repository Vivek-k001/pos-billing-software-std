const API_URL = import.meta.env.VITE_API_URL || "/api";
const SESSION_KEY = "pos-session";

export const readSession = () => {
  try {
    const session = sessionStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));

  // The existing sidebar reads these localStorage values for role-based menu items.
  localStorage.setItem("isLoggedIn", "true");
  localStorage.setItem("userRole", session.user?.role || "");
  localStorage.setItem("username", session.user?.name || session.user?.email || "User");
};

export const clearSession = () => {
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem("pos-remembered-session");
  localStorage.removeItem("pos-session");
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("userRole");
  localStorage.removeItem("username");
};

export const login = async (form) => {
  const response = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form)
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "Authentication failed");
  }

  return payload;
};

export const createApi = (session) => {
  const request = async (path, options = {}) => {
    const response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
        ...options.headers
      }
    });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(payload.message || "Request failed");
    }

    return payload;
  };

  return {
    request,
    getProducts: () => request("/products"),
    createProduct: (payload) => request("/products", { method: "POST", body: JSON.stringify(payload) }),
    updateProduct: (id, payload) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
    getInvoices: () => request("/invoices"),
    createInvoice: (payload) => request("/invoices", { method: "POST", body: JSON.stringify(payload) }),
    voidInvoice: (id) => request(`/invoices/${id}/void`, { method: "PUT" }),
    getPdfHistory: () => request("/invoices/pdfs"),
    getPdfPath: (invoiceNumber) => request(`/invoices/pdf-path/${encodeURIComponent(invoiceNumber)}`),
    updateSettings: (payload) => request("/backup/settings", { method: "PUT", body: JSON.stringify(payload) }),
    checkInternetConnection: () => request("/health/internet")
  };
};
