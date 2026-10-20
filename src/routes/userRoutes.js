
const express = require("express");
const router = express.Router();

const {
  createUser,
  getAllUsers,
} = require("../controllers/userController");

const { protect } = require("../middleware/authMiddleware");
const { allowRoles } = require("../middleware/roleMiddleware");


router.use(protect);


router.post("/", allowRoles("ADMIN"), createUser);
router.get("/", allowRoles("ADMIN"), getAllUsers);

module.exports = router;