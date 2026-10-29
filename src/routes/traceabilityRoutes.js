const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { getTraceability } = require("../controllers/traceabilityController");

router.use(protect);
router.get("/milk-reception/:batchId", getTraceability);

module.exports = router;
