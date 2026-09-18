const router = require("express").Router();

const {
  createProduct,
  getProducts,
  getSingleProduct,
  updateProduct,
  deleteProduct
} = require("../controllers/productController");

const { auth, requireRole } = require("../middleware/authMiddleware");

// CREATE PRODUCT
router.post("/", auth, requireRole("admin"), createProduct);

// GET ALL PRODUCTS
router.get("/", auth, getProducts);

// GET SINGLE PRODUCT
router.get("/:id", auth, getSingleProduct);

// UPDATE PRODUCT
router.put("/:id", auth, requireRole("admin"), updateProduct);

// DELETE PRODUCT
router.delete("/:id", auth, requireRole("admin"), deleteProduct);

module.exports = router;
