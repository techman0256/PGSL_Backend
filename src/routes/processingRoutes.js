const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const {
  getAvailableStorageBatches,
  createProcessingBatch,
  getAllProcessingBatches,
  getProcessingBatchById,
  updateProcessingBatch,
  deleteProcessingBatch,
} = require("../controllers/processingController");

router.use(protect);

router.get("/available-storage-batches", getAvailableStorageBatches);
router.post("/", createProcessingBatch);
router.get("/", getAllProcessingBatches);
router.get("/:id", getProcessingBatchById);
router.put("/:id", updateProcessingBatch);
router.delete("/:id", deleteProcessingBatch);

module.exports = router;

