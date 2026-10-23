const mongoose = require("mongoose");
const MilkBatch = require("../models/MilkBatch");
const MilkQualityTest = require("../models/MilkQualityTest");
const MilkStorageRecord = require("../models/MilkStorageRecord");
const Processing = require("../models/Processing");
const { generateSequenceId } = require("../utils/idGenerator");

// POST /api/milk-batches
const createMilkBatch = async (req, res) => {
  try {
    const { milkType, quantity, date, time, shift } = req.body;

    if (!milkType || quantity == null || !date || !time || !shift) {
      return res.status(400).json({
        message: "Milk type, quantity, date, time and shift are required",
      });
    }

    const amount = Number(quantity);

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({
        message: "Quantity must be greater than zero",
      });
    }

    const validMilkTypes = ["COW", "GOAT", "BUFFALO", "SAHIWAL"];
    const validShifts = ["MORNING", "EVENING"];

    if (!validMilkTypes.includes(milkType.toUpperCase())) {
      return res.status(400).json({ message: "Invalid milk type" });
    }

    if (!validShifts.includes(shift.toUpperCase())) {
      return res.status(400).json({ message: "Invalid shift" });
    }

    // Interpret date and time in the server's local timezone.
    const receivedAt = new Date(`${date}T${time}:00`);

    if (Number.isNaN(receivedAt.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }

    const milkBatchId = await generateSequenceId("MR", receivedAt);

    const batch = await MilkBatch.create({
      milkBatchId,
      milkType: milkType.toUpperCase(),
      quantity: mongoose.Types.Decimal128.fromString(String(amount)),
      receivedAt,
      shift: shift.toUpperCase(),
    });

    return res.status(201).json({
      message: "Milk reception saved successfully",
      batch,
    });
  } catch (error) {
    console.error("Create milk batch error:", error.message);
    return res.status(500).json({
      message: "Failed to save milk reception",
    });
  }
};

// GET /api/milk-batches
const getAllMilkBatches = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const query = MilkBatch.find().sort({ receivedAt: -1 }).lean();

    if (limit && !Number.isNaN(limit) && limit > 0) {
      query.limit(limit);
    }

    const batches = await query.exec();

    return res.status(200).json({
      count: batches.length,
      batches,
    });
  } catch (error) {
    console.error("Get milk batches error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch milk receptions",
    });
  }
};

// GET /api/milk-batches/:id
const getMilkBatchById = async (req, res) => {
  try {
    const batch = await MilkBatch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Milk reception not found" });
    }

    return res.status(200).json({ batch });
  } catch (error) {
    return res.status(400).json({ message: "Invalid milk reception ID" });
  }
};

// PUT /api/milk-batches/:id
const updateMilkBatch = async (req, res) => {
  try {
    const { milkType, quantity, date, time, shift } = req.body;

    const batch = await MilkBatch.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Milk reception not found" });
    }

    if (milkType) batch.milkType = milkType.toUpperCase();
    if (quantity != null) {
      const amount = Number(quantity);
      if (amount <= 0) {
        return res.status(400).json({ message: "Quantity must be greater than zero" });
      }
      batch.quantity = mongoose.Types.Decimal128.fromString(String(amount));
    }
    if (shift) batch.shift = shift.toUpperCase();
    if (date && time) {
      const receivedAt = new Date(`${date}T${time}:00`);
      if (!Number.isNaN(receivedAt.getTime())) {
        batch.receivedAt = receivedAt;
      }
    }

    await batch.save();

    return res.status(200).json({
      message: "Milk reception updated successfully",
      batch,
    });
  } catch (error) {
    console.error("Update milk batch error:", error.message);
    return res.status(500).json({ message: "Failed to update milk reception" });
  }
};

// DELETE /api/milk-batches/:id
const deleteMilkBatch = async (req, res) => {
  try {
    const batch = await MilkBatch.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({
        message: "Milk reception not found",
      });
    }

    // Prevent deletion if later stages already reference this batch.
    const [hasTests, hasStorage, hasProcessing] = await Promise.all([
      MilkQualityTest.exists({ milkBatchId: batch._id }),
      MilkStorageRecord.exists({ milkBatchId: batch._id }),
      Processing.exists({ milkBatchId: batch._id }),
    ]);

    if (hasTests || hasStorage || hasProcessing) {
      return res.status(409).json({
        message:
          "This reception is linked to later processing stages and cannot be deleted.",
      });
    }

    await batch.deleteOne();

    return res.status(200).json({
      message: "Milk reception deleted successfully",
    });
  } catch (error) {
    console.error("Delete milk batch error:", error.message);
    return res.status(400).json({
      message: "Failed to delete milk reception",
    });
  }
};

module.exports = {
  createMilkBatch,
  getAllMilkBatches,
  getMilkBatchById,
  updateMilkBatch,
  deleteMilkBatch,
};
