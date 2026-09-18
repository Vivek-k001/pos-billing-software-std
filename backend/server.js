require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { startScheduler } = require("./utils/scheduler");


const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
  credentials: true
}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/health/internet", async (req, res) => {
  const dns = require("dns");
  const https = require("https");

  const checkConnection = () => {
    return new Promise((resolve) => {
      dns.lookup("google.com", (err) => {
        if (!err) return resolve(true);
        dns.lookup("cloudflare.com", (err2) => {
          if (!err2) return resolve(true);

          const request = https.get("https://clients3.google.com/generate_204", { timeout: 2500 }, (httpRes) => {
            resolve(httpRes.statusCode === 204 || (httpRes.statusCode >= 200 && httpRes.statusCode < 300));
          });
          request.on("error", () => resolve(false));
          request.on("timeout", () => {
            request.destroy();
            resolve(false);
          });
        });
      });
    });
  };

  const isOnline = await checkConnection();
  res.json({ online: isOnline });
});

app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/products", require("./routes/productRoutes"));
app.use("/api/invoices", require("./routes/invoiceRoutes"));
app.use("/api/backup", require("./routes/backupRoutes"));

const frontendDist = path.join(__dirname, "..", "frontend", "dist");
const invoiceHistoryPath = path.join(__dirname, "..", "Invoice History");

app.use(express.static(frontendDist));
app.use("/pdfs", express.static(invoiceHistoryPath));

app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api")) {
    const indexPath = path.join(frontendDist, "index.html");
    if (require("fs").existsSync(indexPath)) {
      return res.sendFile(indexPath);
    } else {
      return res.status(404).send("Frontend build not found. Please run 'npm run build' in the root directory first.");
    }
  }

  next();
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]:", err);
  res.status(err.status || 500).json({
    message: err.message || "An unexpected error occurred on the server.",
    error: process.env.NODE_ENV === "development" ? err : {}
  });
});

const server = app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server running privately on http://127.0.0.1:${PORT}`);
  connectDB()
    .then(() => {
      console.log("Database initialized");
      startScheduler();
    })
    .catch((err) => console.error("Database initialization failed:", err));
});
