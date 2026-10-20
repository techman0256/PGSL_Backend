
const mongoose = require("mongoose");
const MilkBatch = require("../models/MilkBatch");
const BatchCounter = require("../models/BatchCounter");

const generateBatchId = async (receivedAt) => {
  const datePart = [
    receivedAt.getFullYear(),
    String(receivedAt.getMonth() + 1).padStart(2, "0"),
    String(receivedAt.getDate()).padStart(2, "0"),
  ].join("");

  const counter = await BatchCounter.findOneAndUpdate(
    { _id: datePart },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }
  );

  return `MR-${datePart}-${String(counter.sequence).padStart(3, "0")}`;
};

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

    if (!validMilkTypes.includes(milkType)) {
      return res.status(400).json({ message: "Invalid milk type" });
    }

    if (!validShifts.includes(shift)) {
      return res.status(400).json({ message: "Invalid shift" });
    }

    // Interpret date and time in the server's local timezone.
    const receivedAt = new Date(`${date}T${time}:00`);

    if (Number.isNaN(receivedAt.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }

    const milkBatchId = await generateBatchId(receivedAt);

    const batch = await MilkBatch.create({
      milkBatchId,
      milkType,
      quantity: mongoose.Types.Decimal128.fromString(String(quantity)),
      receivedAt,
      shift,
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
    const batches = await MilkBatch.find()
      .sort({ receivedAt: -1 })
      .limit(4)
      .lean();

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
    const MilkQualityTest = mongoose.model("MilkQualityTest");
    const MilkStorageRecord = mongoose.model("MilkStorageRecord");
    const Processing = mongoose.model("Processing");

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
  getMilkBatchById
};
