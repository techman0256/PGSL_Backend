
const express = require("express");
const router = express.Router();

const {
  createUser,
  getAllUsers,
  updateUserRole,
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.use(protect);


router.post("/", allowRoles("ADMIN"), createUser);
router.get("/", allowRoles("ADMIN"), getAllUsers);
router.put("/:id/role", allowRoles("ADMIN"), updateUserRole);

module.exports = router;