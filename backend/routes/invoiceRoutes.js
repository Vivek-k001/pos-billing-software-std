const router = require("express").Router();
const { createInvoice, getInvoices, voidInvoice, getPdfHistory, getPdfPath } = require("../controllers/invoiceController");
const { auth, requireRole } = require("../middleware/authMiddleware");

router.post("/", auth, createInvoice);
router.get("/", auth, requireRole("admin", "staff"), getInvoices);
router.get("/pdfs", auth, requireRole("admin", "staff"), getPdfHistory);
router.get("/pdf-path/:invoiceNumber", auth, requireRole("admin", "staff"), getPdfPath);
router.put("/:id/void", auth, requireRole("admin"), voidInvoice);

module.exports = router;
