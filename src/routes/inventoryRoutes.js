const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getInventorySummary,
  getFinishedProducts,
  getRawMaterials,
  addRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
} = require("../controllers/inventoryController");

router.use(protect);

router.get("/summary", getInventorySummary);
router.get("/finished-products", getFinishedProducts);
router.get("/raw-materials", getRawMaterials);
router.post("/raw-materials", addRawMaterial);
router.put("/raw-materials/:id", updateRawMaterial);
router.delete("/raw-materials/:id", deleteRawMaterial);

module.exports = router;

