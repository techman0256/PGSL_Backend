const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const milkBatchRoutes = require("./routes/milkBatchRoutes");
const qualityTestRoutes = require("./routes/qualityTestRoutes");
const rawMilkStorageRoutes = require("./routes/rawMilkStorageRoutes");
const processingRoutes = require("./routes/processingRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
//const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

app.use(cors({ credentials: true, origin: true }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Milk Plant Backend is running",
    timestamp: new Date().toISOString(),
  });
});

// ERP Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/milk-batches", milkBatchRoutes);
app.use("/api/quality-tests", qualityTestRoutes);
app.use("/api/raw-milk-storage", rawMilkStorageRoutes);
app.use("/api/processing", processingRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/dispatches", dispatchRoutes);
//app.use("/api/dashboard", dashboardRoutes);

// Catch-all 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `API route ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized error handler
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal server error",
  });
});

module.exports = app;
