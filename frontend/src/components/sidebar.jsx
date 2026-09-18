import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { FileText, BarChart2, BarChart3, LayoutDashboard, LogOut, Menu, X, Package, History } from "lucide-react";
import "./sidebar.css";

const Sidebar = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const role      = localStorage.getItem("userRole");
  const username  = localStorage.getItem("username") || "User";
  const isOwner   = role === "admin";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [time, setTime] = useState(new Date());
  const [is24Hour, setIs24Hour] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // "cancel" = left button focused, "logout" = right button focused
  const [modalFocus, setModalFocus] = useState("cancel");

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard navigation for the logout modal
  useEffect(() => {
    if (!showLogoutModal) return;
    const handleKey = (e) => {
      if (e.key === "ArrowLeft")  { e.preventDefault(); setModalFocus("cancel"); }
      if (e.key === "ArrowRight") { e.preventDefault(); setModalFocus("logout"); }
      if (e.key === "Enter") {
        e.preventDefault(); // Prevent browser from firing click on the still-focused sidebar Logout button
        if (modalFocus === "logout") confirmLogout();
        else setShowLogoutModal(false);
      }
      if (e.key === "Escape") setShowLogoutModal(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [showLogoutModal, modalFocus]);

  const formatTime = (date) => {
    let hours = date.getHours();
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    
    if (!is24Hour) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      hours = hours.toString().padStart(2, '0');
      return `${hours}:${minutes}:${seconds} ${ampm}`;
    }
    
    hours = hours.toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Shows the confirmation modal (resets focus to Cancel each time)
  const handleLogout = () => {
    setModalFocus("cancel");
    setShowLogoutModal(true);
  };

  // Actual logout — only called after user confirms
  const confirmLogout = () => {
    sessionStorage.removeItem("pos-session");
    localStorage.removeItem("pos-remembered-session");
    localStorage.removeItem("pos-session");
    localStorage.removeItem("isLoggedIn");
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    window.dispatchEvent(new Event("pos-session-cleared"));
    navigate("/");
  };

  // Separate ordered lists per role — no filtering needed
  const ownerNavItems = [
    { label: "Dashboard",       icon: <LayoutDashboard size={17}/>, path: "/dashboard"      },
    { label: "Products",        icon: <Package size={17}/>,          path: "/products"       },
    { label: "Invoice Entry",   icon: <FileText size={17}/>,        path: "/invoice"        },
    { label: "Invoice History", icon: <History size={17}/>,         path: "/invoices"       },
    { label: "Daily Report",    icon: <BarChart2 size={17}/>,       path: "/daily-report"   },
    { label: "Monthly Report",  icon: <BarChart3 size={17}/>,       path: "/monthly-report" },
  ];

  // Staff Module (Temporarily Disabled)
  // TODO: Re-enable if Staff functionality is needed in the future.
  /*
  const staffNavItems = [
    { label: "Invoice Entry",   icon: <FileText size={17}/>,        path: "/invoice"        },
    { label: "Invoice History", icon: <History size={17}/>,         path: "/invoices"       },
    { label: "Daily Report",    icon: <BarChart2 size={17}/>,       path: "/daily-report"   },
  ];
  */

  // const navItems = isOwner ? ownerNavItems : staffNavItems;
  const navItems = ownerNavItems;

  const handleNav = (path) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="mobile-topbar">
        <div className="mobile-brand">
          <img src="/logo.png" alt="logo" className="mobile-logo" />
          <span>IMAGE OFFICE</span>
        </div>
        <button className="mobile-hamburger" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={22} />
        </button>
      </div>

      {/* ── Overlay ── */}
      {mobileOpen && <div className="sb-overlay" onClick={() => setMobileOpen(false)} />}

      {/* ── Sidebar panel ── */}
      <div className={`sidebar ${mobileOpen ? "mobile-open" : ""}`}>

        {/* Close button (mobile only) */}
        <button className="sb-close-btn" onClick={() => setMobileOpen(false)} aria-label="Close menu">
          <X size={20} />
        </button>

        <div className="sb-brand">
          <img src="/logo.png" alt="logo" className="sb-logo" />
          <div className="sb-brand-text">
            <span className="sb-brand-name">IMAGE OFFICE</span>
            <span className="sb-brand-sub">Point of Sale</span>
          </div>
        </div>

        {/* Staff Module (Temporarily Disabled) */}
        {/* <div className={`sb-role-badge ${isOwner ? "admin" : "staff"}`}>
          {isOwner ? "👑 Admin" : "👤 Staff"} — {username}
        </div> */}


        <nav className="sb-nav">
          {navItems.map((item) => (
            <div key={item.path} className={`sb-item-wrap ${location.pathname === item.path ? "active" : ""}`}>
              <button
                className={`sb-btn ${location.pathname === item.path ? "active" : ""}`}
                onClick={() => handleNav(item.path)}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            </div>
          ))}

          {/* Logout always right below the last nav button */}
          <div className="sb-logout-divider" />
          <button className="sb-btn sb-logout" onClick={handleLogout}>
            <LogOut size={17} />
            <span>Logout</span>
          </button>
        </nav>

        {/* Digital Clock */}
        <div 
          className="sb-clock" 
          onDoubleClick={() => setIs24Hour(!is24Hour)}
          title="Double tap to toggle 12/24 hour format"
        >
          {formatTime(time)}
        </div>

      </div>

      {/* ── Logout Confirmation Modal ── */}
      {showLogoutModal && (
        <div className="logout-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="logout-modal" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true" aria-labelledby="logout-title">
            <h3 className="logout-modal-title" id="logout-title">Logging out?</h3>
            <p className="logout-modal-sub">You will be returned to the login screen.</p>
            <div className="logout-modal-btns">
              <button
                className={`logout-modal-btn cancel ${modalFocus === "cancel" ? "focused" : ""}`}
                onClick={() => setShowLogoutModal(false)}
                onMouseEnter={() => setModalFocus("cancel")}
              >
                Cancel
              </button>
              <button
                className={`logout-modal-btn confirm ${modalFocus === "logout" ? "focused" : ""}`}
                onClick={confirmLogout}
                onMouseEnter={() => setModalFocus("logout")}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
