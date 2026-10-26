const express = require("express");
const router = express.Router();

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");
const {
  getAvailableProductsForDispatch,
  createDispatch,
  getAllDispatches,
  getDispatchById,
  updateDispatch,
  deleteDispatch,
} = require("../controllers/dispatchController");

router.use(protect);

router.get("/available-products", getAvailableProductsForDispatch);
router.post("/", createDispatch);
router.get("/", getAllDispatches);
router.get("/:id", getDispatchById);
router.put("/:id", updateDispatch);
router.delete("/:id", allowRoles("ADMIN"), deleteDispatch);

module.exports = router;
