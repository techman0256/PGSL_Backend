const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getInventorySummary,
  getFinishedProducts,
  addFinishedProduct,
  getRawMaterials,
  addRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
} = require("../controllers/inventoryController");

router.use(protect);

router.get("/summary", getInventorySummary);
router.get("/finished-products", getFinishedProducts);
router.post("/finished-products", addFinishedProduct);
router.get("/raw-materials", getRawMaterials);
router.post("/raw-materials", addRawMaterial);
router.put("/raw-materials/:id", updateRawMaterial);
router.delete("/raw-materials/:id", allowRoles("ADMIN"), deleteRawMaterial);

module.exports = router;
