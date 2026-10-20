const express = require("express");
const cors = require("cors");



const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");

const milkBatchRoutes = require("./routes/milkBatchRoutes");

const milkQualityRoutes = require("./routes/milkQualityRoutes");

const app = express();

app.use(cors({credentials: true, origin: true}));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Milk Plant Backend is running"
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);

app.use("/api/milk-batches", milkBatchRoutes);

app.use("/api/quality-tests", milkQualityRoutes);

module.exports = app;