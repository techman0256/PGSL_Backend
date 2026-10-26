const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getAvailableBatchesForTesting,
  createQualityTest,
  getAllQualityTests,
  getQualityTestById,
  updateQualityTest,
  deleteQualityTest,
} = require("../controllers/qualityTestController");

router.use(protect);

router.get("/available-batches", getAvailableBatchesForTesting);
router.post("/", createQualityTest);
router.get("/", getAllQualityTests);
router.get("/:id", getQualityTestById);
router.put("/:id", updateQualityTest);
router.delete("/:id", allowRoles("ADMIN"), deleteQualityTest);

module.exports = router;
