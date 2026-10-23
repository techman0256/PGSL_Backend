const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  createMilkBatch,
  getAllMilkBatches,
  getMilkBatchById,
  updateMilkBatch,
  deleteMilkBatch,
} = require("../controllers/milkBatchController");

router.use(protect);

router.post("/", createMilkBatch);
router.get("/", getAllMilkBatches);
router.get("/:id", getMilkBatchById);
router.put("/:id", updateMilkBatch);
router.delete("/:id", deleteMilkBatch);

module.exports = router;
