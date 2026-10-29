const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const milkBatchRoutes = require("./routes/milkBatchRoutes");
const qualityTestRoutes = require("./routes/qualityTestRoutes");
const rawMilkStorageRoutes = require("./routes/rawMilkStorageRoutes");
const processingRoutes = require("./routes/processingRoutes");
const inventoryRoutes = require("./routes/inventoryRoutes");
const dispatchRoutes = require("./routes/dispatchRoutes");
const traceabilityRoutes = require("./routes/traceabilityRoutes");
//const dashboardRoutes = require("./routes/dashboardRoutes");

const app = express();

const allowedOrigin = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
console.log("These are allowed origin ************", allowedOrigin);

app.use(cors({ credentials: true, origin: allowedOrigin }));
app.use(express.json());
app.use(cookieParser());

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
app.use("/api/traceability", traceabilityRoutes);
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
