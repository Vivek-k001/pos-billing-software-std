import React, { useState, useRef, useEffect } from "react";
import "./login.css";

const Login = ({ onLogin }) => {
  const [userRole, setUserRole]           = useState("admin");
  const [username, setUsername]           = useState("");
  const [password, setPassword]           = useState("");
  const [showPassword, setShowPassword]   = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [errorMsg, setErrorMsg]           = useState("");
  const passwordInputRef                  = useRef(null);
  const [greeting, setGreeting]           = useState("");
  const [dateInfo, setDateInfo]           = useState({ dayStr: "", monthStr: "", dateNum: "" });

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    if (hour < 12) setGreeting("Good Morning!");
    else if (hour < 17) setGreeting("Good Afternoon!");
    else if (hour < 21) setGreeting("Good Evening!");
    else setGreeting("Good Night!");

    const dayStr = now.toLocaleDateString("en-US", { weekday: "short" });
    const monthStr = now.toLocaleDateString("en-US", { month: "short" });
    const dateNum = now.getDate();
    setDateInfo({ dayStr, monthStr, dateNum });
  }, []);

  const handleUsernameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = username.trim().toLowerCase();
      if (val === "admin" || val === "admin@pos.com") {
        setErrorMsg("");
        if (passwordInputRef.current) {
          passwordInputRef.current.focus();
        }
      } else {
        setErrorMsg("Please enter a correct username");
      }
    }
  };
  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    
    // Map simple username 'admin'/'staff' to the expected emails, or just use as email
    let email = username.trim().toLowerCase();
    if (userRole === "admin" && email === "admin") email = "admin@pos.com";
    // Staff Module (Temporarily Disabled)
    // TODO: Re-enable if Staff functionality is needed in the future.
    // if (userRole === "staff" && email === "staff") email = "staff@pos.com";

    try {
      if (onLogin) {
        await onLogin({ email, password });
      }
    } catch (err) {
      setErrorMsg(err.message || "Invalid username or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-wrapper">

      {/* ── LEFT — Branding ── */}
      <div className="login-left">
        <div className="left-bg-decor" />
        <div className="left-bg-decor2" />
        <div className="left-bg-decor3" />

        <div className="top-left-widgets">
          <div className="calendar-widget">
            <div className="cal-header">
              <span className="cal-day">{dateInfo.dayStr}</span>
              <span className="cal-month">{dateInfo.monthStr}</span>
            </div>
            <div className="cal-date">{dateInfo.dateNum}</div>
          </div>
          <div className="time-greeting">{greeting}</div>
        </div>

        <div className="branding">
          <div className="logo-ring">
            <div className="logo-circle">
              <img src="/logo.png" alt="POS Logo" />
            </div>
          </div>
          <h1 className="brand-title">POS Billing System</h1>
          <p className="brand-sub">Professional Invoice Management</p>
          <div className="brand-badges">
            <span className="badge">Fast Billing</span>
            <span className="badge">Tax Invoices</span>
            <span className="badge">Reports</span>
          </div>
        </div>

        <p className="left-footer">© {new Date().getFullYear()} Image Office Solutions. All rights reserved.</p>
      </div>

      {/* ── RIGHT — Login Form ── */}
      <div className="login-right">
        <div className="login-card">

          <div className="card-header">
            <div className="header-logo-wrap">
              <img src="/logo.png" alt="Image Office Solutions" className="header-logo-img" />
            </div>
            <h2 className="card-title">Welcome Back</h2>
            <p className="card-sub">Sign in to your POS account</p>
          </div>

          {/* Role Selector Tabs */}
          {/* Staff Module (Temporarily Disabled) */}
          {/* TODO: Re-enable if Staff functionality is needed in the future. */}
          {/*
          <div className="role-tabs">
            <button
              type="button"
              className={`role-tab ${userRole === "admin" ? "active" : ""}`}
              onClick={() => {
                setUserRole("admin");
                setUsername("");
                setPassword("");
                setErrorMsg("");
              }}
            >
              Admin
            </button>
            <button
              type="button"
              className={`role-tab ${userRole === "staff" ? "active" : ""}`}
              onClick={() => {
                setUserRole("staff");
                setUsername("");
                setPassword("");
                setErrorMsg("");
              }}
            >
              Staff
            </button>
          </div>
          */}

          {errorMsg && (
            <div className="error-msg">
              <svg viewBox="0 0 24 24" fill="none" width="15" height="15">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="login-form" noValidate>

            <div className="form-group">
              <label htmlFor="username">Username or Email</label>
              <div className="input-wrapper">
                <input id="username" type="text" 
                  // Staff Module (Temporarily Disabled)
                  // placeholder={userRole === "admin" ? "Enter username" : "Enter 'staff'"}
                  placeholder="Enter username"
                  value={username} onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleUsernameKeyDown}
                  autoComplete="username" autoFocus required />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-wrapper">
                <input id="password" type={showPassword ? "text" : "password"}
                  ref={passwordInputRef}
                  placeholder="Enter your password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password" required />
                <button type="button" className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <line x1="1" y1="1" x2="23" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>


            <button type="submit"
              className={`login-btn ${isLoading ? "loading" : ""}`}
              disabled={isLoading}>
              {isLoading ? (
                <><span className="spinner" /> Signing in...</>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" className="btn-icon">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  Sign In
                </>
              )}
            </button>

          </form>

          <p className="card-footer">
            Secure login for <strong>Image Office Solutions</strong>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
