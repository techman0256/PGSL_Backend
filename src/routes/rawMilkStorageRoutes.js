const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getAvailableBatchesForStorage,
  createStorageRecord,
  getAllStorageRecords,
  getSilosOverview,
  getStorageRecordById,
  updateStorageRecord,
  deleteStorageRecord,
} = require("../controllers/rawMilkStorageController");

router.use(protect);

router.get("/available-batches", getAvailableBatchesForStorage);
router.get("/silos", getSilosOverview);
router.post("/", createStorageRecord);
router.get("/", getAllStorageRecords);
router.get("/:id", getStorageRecordById);
router.put("/:id", updateStorageRecord);
router.delete("/:id", allowRoles("ADMIN"), deleteStorageRecord);

module.exports = router;
