
const bcrypt = require("bcryptjs");
const User = require("../models/User");

// POST /api/users
// ADMIN only
const createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name?.trim() || !email?.trim() || !password || !role) {
      return res.status(400).json({
        message: "Name, email, password and role are required",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        message: "Password must be at least 8 characters long",
      });
    }

    if (!["ADMIN", "OPERATOR"].includes(role)) {
      return res.status(400).json({
        message: "Role must be ADMIN or OPERATOR",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "An account with this email already exists",
      });
    }

    console.error("Create user error:", error.message);

    return res.status(500).json({
      message: "Failed to create user",
    });
  }
};

// GET /api/users
// ADMIN only
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select("name email role isActive createdAt updatedAt")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      count: users.length,
      users,
    });
  } catch (error) {
    console.error("Get users error:", error.message);

    return res.status(500).json({
      message: "Failed to fetch users",
    });
  }
};

// PUT /api/users/:id/role
// ADMIN only
const updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!["ADMIN", "OPERATOR"].includes(role)) {
      return res.status(400).json({ message: "Role must be ADMIN or OPERATOR" });
    }

    if (req.params.id === req.user.id && role !== "ADMIN") {
      return res.status(400).json({ message: "You cannot remove your own admin role" });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    ).select("name email role isActive");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user role error:", error.message);
    return res.status(500).json({ message: "Failed to update user role" });
  }
};

module.exports = {
  createUser,
  getAllUsers,
  updateUserRole,
};