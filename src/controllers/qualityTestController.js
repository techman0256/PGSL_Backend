const mongoose = require("mongoose");
const MilkQualityTest = require("../models/MilkQualityTest");
const MilkBatch = require("../models/MilkBatch");
const MilkStorageRecord = require("../models/MilkStorageRecord");
const Processing = require("../models/Processing");

const serializeBatch = (batch) => ({
  ...batch,
  quantity: batch?.quantity == null
    ? batch?.quantity
    : Number(batch.quantity.toString()),
});

// GET /api/quality-tests/available-batches
// Returns batches ready for testing (received batches not yet tested)
const getAvailableBatchesForTesting = async (req, res) => {
  try {
    const testedBatchIds = await MilkQualityTest.distinct("milkBatchId");

    const availableBatches = await MilkBatch.find({
      _id: { $nin: testedBatchIds },
    })
      .sort({ receivedAt: -1 })
      .lean();

    return res.status(200).json({
      count: availableBatches.length,
      batches: availableBatches.map(serializeBatch),
    });
  } catch (error) {
    console.error("Get available batches for testing error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch available batches for testing",
    });
  }
};

// POST /api/quality-tests
const createQualityTest = async (req, res) => {
  try {
    const {
      milkBatchId,
      batchId,
      fat,
      snf,
      temperature,
      testDate,
      testTime,
      remarks,
    } = req.body;

    if (!milkBatchId && !batchId) {
      return res.status(400).json({
        message: "Milk Batch ID is required",
      });
    }

    if (fat == null || snf == null || temperature == null || !testTime) {
      return res.status(400).json({
        message: "Fat (%), SNF (%), Temperature (°C) and Test Time are required",
      });
    }

    // Resolve milk batch
    let batch;
    if (milkBatchId) {
      batch = mongoose.isValidObjectId(milkBatchId)
        ? await MilkBatch.findById(milkBatchId)
        : await MilkBatch.findOne({ milkBatchId });
    }
    if (!batch && batchId) {
      batch = await MilkBatch.findOne({ milkBatchId: batchId });
    }

    if (!batch) {
      return res.status(404).json({
        message: "Milk reception batch not found",
      });
    }

    // Check if already tested
    const existingTest = await MilkQualityTest.findOne({ milkBatchId: batch._id });
    if (existingTest) {
      return res.status(409).json({
        message: "Quality test already exists for this milk batch",
      });
    }

    const testRecord = await MilkQualityTest.create({
      milkBatchId: batch._id,
      batchId: batch.milkBatchId,
      fat: Number(fat),
      snf: Number(snf),
      temperature: Number(temperature),
      testDate: testDate ? new Date(testDate) : new Date(),
      testTime: testTime.trim(),
      remarks: remarks || "",
    });

    return res.status(201).json({
      message: "Quality test result saved successfully",
      test: testRecord,
    });
  } catch (error) {
    console.error("Create quality test error:", error.message);
    return res.status(500).json({
      message: "Failed to save quality test result",
    });
  }
};

// GET /api/quality-tests
const getAllQualityTests = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const query = MilkQualityTest.find()
      .populate("milkBatchId", "milkBatchId milkType quantity shift receivedAt")
      .sort({ createdAt: -1 })
      .lean();

    if (limit && !Number.isNaN(limit) && limit > 0) {
      query.limit(limit);
    }

    const tests = await query.exec();

    return res.status(200).json({
      count: tests.length,
      tests,
    });
  } catch (error) {
    console.error("Get quality tests error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch quality test records",
    });
  }
};

// GET /api/quality-tests/:id
const getQualityTestById = async (req, res) => {
  try {
    const test = await MilkQualityTest.findById(req.params.id).populate("milkBatchId");

    if (!test) {
      return res.status(404).json({ message: "Quality test record not found" });
    }

    return res.status(200).json({ test });
  } catch (error) {
    return res.status(400).json({ message: "Invalid test ID" });
  }
};

// PUT /api/quality-tests/:id
const updateQualityTest = async (req, res) => {
  try {
    const { fat, snf, temperature, testDate, testTime, remarks } = req.body;

    const test = await MilkQualityTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: "Quality test record not found" });
    }

    if (fat != null) test.fat = Number(fat);
    if (snf != null) test.snf = Number(snf);
    if (temperature != null) test.temperature = Number(temperature);
    if (testDate) test.testDate = new Date(testDate);
    if (testTime) test.testTime = testTime.trim();
    if (remarks !== undefined) test.remarks = remarks;

    await test.save();

    return res.status(200).json({
      message: "Quality test record updated successfully",
      test,
    });
  } catch (error) {
    console.error("Update quality test error:", error.message);
    return res.status(500).json({ message: "Failed to update quality test record" });
  }
};

// DELETE /api/quality-tests/:id
const deleteQualityTest = async (req, res) => {
  try {
    const test = await MilkQualityTest.findById(req.params.id);
    if (!test) {
      return res.status(404).json({ message: "Quality test record not found" });
    }

    const [hasStorage, hasProcessing] = await Promise.all([
      MilkStorageRecord.exists({ milkBatchId: test.milkBatchId }),
      Processing.exists({ milkBatchId: test.milkBatchId }),
    ]);

    if (hasStorage || hasProcessing) {
      return res.status(409).json({
        message:
          "This test is linked to stored or processed milk batches and cannot be deleted.",
      });
    }

    await test.deleteOne();

    return res.status(200).json({
      message: "Quality test record deleted successfully",
    });
  } catch (error) {
    console.error("Delete quality test error:", error.message);
    return res.status(500).json({ message: "Failed to delete quality test record" });
  }
};

module.exports = {
  getAvailableBatchesForTesting,
  createQualityTest,
  getAllQualityTests,
  getQualityTestById,
  updateQualityTest,
  deleteQualityTest,
};
