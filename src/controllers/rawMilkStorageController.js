const MilkStorageRecord = require("../models/MilkStorageRecord");
const MilkQualityTest = require("../models/MilkQualityTest");
const MilkBatch = require("../models/MilkBatch");
const Processing = require("../models/Processing");

// Format milk type as displayed in Figma (e.g., "COW" -> "Cow Milk")
const formatMilkType = (type) => {
  if (!type) return "Milk";
  const normalized = type.toUpperCase();
  if (normalized === "COW") return "Cow Milk";
  if (normalized === "BUFFALO") return "Buffalo Milk";
  if (normalized === "GOAT") return "Goat Milk";
  if (normalized === "SAHIWAL") return "Sahiwal Milk";
  return `${type} Milk`;
};

// GET /api/raw-milk-storage/available-batches
// Returns batches that completed Quality Testing and are available for storage
const getAvailableBatchesForStorage = async (req, res) => {
  try {
    const testedBatchIds = await MilkQualityTest.distinct("milkBatchId");
    const storedBatchIds = await MilkStorageRecord.distinct("milkBatchId");

    const availableBatches = await MilkBatch.find({
      _id: { $in: testedBatchIds, $nin: storedBatchIds },
    })
      .sort({ receivedAt: -1 })
      .lean();

    const formattedBatches = availableBatches.map((b) => ({
      _id: b._id,
      milkBatchId: b.milkBatchId,
      milkType: formatMilkType(b.milkType),
      rawMilkType: b.milkType,
      quantity: Number(b.quantity ? b.quantity.toString() : 0),
      shift: b.shift,
      receivedAt: b.receivedAt,
    }));

    return res.status(200).json({
      count: formattedBatches.length,
      batches: formattedBatches,
    });
  } catch (error) {
    console.error("Get available batches for storage error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch available quality-tested batches",
    });
  }
};

// POST /api/raw-milk-storage
const createStorageRecord = async (req, res) => {
  try {
    const {
      milkBatchId,
      batchId,
      siloNumber,
      storageTemperature,
      storageDate,
      storageTime,
      quantity,
      remarks,
    } = req.body;

    if (!milkBatchId && !batchId) {
      return res.status(400).json({ message: "Milk Batch ID is required" });
    }

    if (!siloNumber || storageTemperature == null || !storageTime) {
      return res.status(400).json({
        message: "Silo number, storage temperature and storage time are required",
      });
    }

    // Resolve milk batch
    let batch;
    if (milkBatchId) {
      batch = await MilkBatch.findById(milkBatchId);
    }
    if (!batch && batchId) {
      batch = await MilkBatch.findOne({ milkBatchId: batchId });
    }

    if (!batch) {
      return res.status(404).json({ message: "Milk batch not found" });
    }

    // Verify batch has completed quality testing
    const qualityTest = await MilkQualityTest.findOne({ milkBatchId: batch._id });
    if (!qualityTest) {
      return res.status(400).json({
        message: "Only batches that completed Quality Testing are available for storage.",
      });
    }

    // Check if already stored
    const existingStorage = await MilkStorageRecord.findOne({ milkBatchId: batch._id });
    if (existingStorage) {
      return res.status(409).json({
        message: "A storage record already exists for this milk batch.",
      });
    }

    const batchQty = Number(batch.quantity ? batch.quantity.toString() : 0);
    const storeQuantity = quantity != null ? Number(quantity) : batchQty;

    if (storeQuantity <= 0) {
      return res.status(400).json({ message: "Storage quantity must be greater than zero" });
    }

    const storageRecord = await MilkStorageRecord.create({
      milkBatchId: batch._id,
      batchId: batch.milkBatchId,
      milkType: formatMilkType(batch.milkType),
      quantity: storeQuantity,
      siloNumber: siloNumber.trim(),
      storageTemperature: Number(storageTemperature),
      storageDate: storageDate ? new Date(storageDate) : new Date(),
      storageTime: storageTime.trim(),
      remarks: remarks || "",
    });

    return res.status(201).json({
      message: "Storage record saved successfully",
      record: storageRecord,
    });
  } catch (error) {
    console.error("Create storage record error:", error.message);
    return res.status(500).json({ message: "Failed to save storage record" });
  }
};

// GET /api/raw-milk-storage
const getAllStorageRecords = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const query = MilkStorageRecord.find()
      .populate("milkBatchId", "milkBatchId milkType quantity shift receivedAt")
      .sort({ createdAt: -1 })
      .lean();

    if (limit && !Number.isNaN(limit) && limit > 0) {
      query.limit(limit);
    }

    const records = await query.exec();

    return res.status(200).json({
      count: records.length,
      records,
    });
  } catch (error) {
    console.error("Get storage records error:", error.message);
    return res.status(500).json({ message: "Failed to fetch storage records" });
  }
};

// GET /api/raw-milk-storage/silos
const getSilosOverview = async (req, res) => {
  try {
    const records = await MilkStorageRecord.find().sort({ createdAt: -1 }).lean();

    const siloMap = {};
    for (let i = 1; i <= 6; i++) {
      const siloKey = `Silo 0${i}`;
      siloMap[siloKey] = {
        siloNumber: siloKey,
        currentLitres: 0,
        milkType: null,
        temperature: null,
        batches: [],
      };
    }

    records.forEach((r) => {
      if (!siloMap[r.siloNumber]) {
        siloMap[r.siloNumber] = {
          siloNumber: r.siloNumber,
          currentLitres: 0,
          milkType: r.milkType,
          temperature: r.storageTemperature,
          batches: [],
        };
      }
      siloMap[r.siloNumber].currentLitres += r.quantity;
      siloMap[r.siloNumber].milkType = r.milkType;
      siloMap[r.siloNumber].temperature = r.storageTemperature;
      siloMap[r.siloNumber].batches.push({
        batchId: r.batchId,
        quantity: r.quantity,
      });
    });

    return res.status(200).json({
      silos: Object.values(siloMap),
    });
  } catch (error) {
    console.error("Get silos overview error:", error.message);
    return res.status(500).json({ message: "Failed to fetch silos overview" });
  }
};

// GET /api/raw-milk-storage/:id
const getStorageRecordById = async (req, res) => {
  try {
    const record = await MilkStorageRecord.findById(req.params.id).populate("milkBatchId");

    if (!record) {
      return res.status(404).json({ message: "Storage record not found" });
    }

    return res.status(200).json({ record });
  } catch (error) {
    return res.status(400).json({ message: "Invalid storage record ID" });
  }
};

// PUT /api/raw-milk-storage/:id
const updateStorageRecord = async (req, res) => {
  try {
    const { siloNumber, storageTemperature, storageDate, storageTime, remarks, quantity } = req.body;

    const record = await MilkStorageRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Storage record not found" });
    }

    if (siloNumber) record.siloNumber = siloNumber.trim();
    if (storageTemperature != null) record.storageTemperature = Number(storageTemperature);
    if (storageDate) record.storageDate = new Date(storageDate);
    if (storageTime) record.storageTime = storageTime.trim();
    if (remarks !== undefined) record.remarks = remarks;
    if (quantity != null) record.quantity = Number(quantity);

    await record.save();

    return res.status(200).json({
      message: "Storage record updated successfully",
      record,
    });
  } catch (error) {
    console.error("Update storage record error:", error.message);
    return res.status(500).json({ message: "Failed to update storage record" });
  }
};

// DELETE /api/raw-milk-storage/:id
const deleteStorageRecord = async (req, res) => {
  try {
    const record = await MilkStorageRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ message: "Storage record not found" });
    }

    const hasProcessing = await Processing.exists({
      $or: [{ inputMilkBatch: record.batchId }, { milkBatchId: record.milkBatchId }],
    });

    if (hasProcessing) {
      return res.status(409).json({
        message:
          "This storage record is linked to processing batches and cannot be deleted.",
      });
    }

    await record.deleteOne();

    return res.status(200).json({
      message: "Storage record deleted successfully",
    });
  } catch (error) {
    console.error("Delete storage record error:", error.message);
    return res.status(500).json({ message: "Failed to delete storage record" });
  }
};

module.exports = {
  getAvailableBatchesForStorage,
  createStorageRecord,
  getAllStorageRecords,
  getSilosOverview,
  getStorageRecordById,
  updateStorageRecord,
  deleteStorageRecord,
};
