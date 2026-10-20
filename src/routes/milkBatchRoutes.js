
const express = require("express");
const router = express.Router();

const { protect, allowRoles } = require("../middleware/authMiddleware");
const {
  createMilkBatch,
  getAllMilkBatches,
  getMilkBatchById
} = require("../controllers/milkBatchController");

router.use(protect);

router.post("/", createMilkBatch);
router.get("/", getAllMilkBatches);
router.get("/:id", getMilkBatchById);

module.exports = router;
