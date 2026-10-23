const mongoose = require("mongoose");
const Processing = require("../models/Processing");
const MilkStorageRecord = require("../models/MilkStorageRecord");
const MilkBatch = require("../models/MilkBatch");
const RawMaterial = require("../models/RawMaterial");
const FinishedProduct = require("../models/FinishedProduct");
const Dispatch = require("../models/Dispatch");
const { generateSequenceId } = require("../utils/idGenerator");

// GET /api/processing/available-storage-batches
// Returns quality-tested milk batches available in Raw Milk Storage
const getAvailableStorageBatches = async (req, res) => {
  try {
    const records = await MilkStorageRecord.find()
      .sort({ createdAt: -1 })
      .lean();

    const formatted = records.map((r) => ({
      milkBatchId: r.milkBatchId,
      batchId: r.batchId,
      milkType: r.milkType,
      siloNumber: r.siloNumber,
      quantity: r.quantity,
      storageDate: r.storageDate,
      storageTime: r.storageTime,
    }));

    return res.status(200).json({
      count: formatted.length,
      batches: formatted,
    });
  } catch (error) {
    console.error("Get available storage batches error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch available storage batches",
    });
  }
};

// POST /api/processing
const createProcessingBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      inputMilkBatch,
      inputBatchId,
      inputQuantity,
      processingDate,
      processingTime,
      productType,
      outputQuantity,
      outputUnit,
      rawMaterialsUsed = [],
      byProducts = [],
      remarks,
    } = req.body;

    const batchCode = (inputMilkBatch || inputBatchId || "").trim();

    if (!batchCode) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Input milk batch is required" });
    }

    const inQty = Number(inputQuantity);
    const outQty = Number(outputQuantity);

    if (!inQty || inQty <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Input quantity must be greater than zero" });
    }

    if (!outQty || outQty <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Output quantity must be greater than zero" });
    }

    if (!productType || !processingTime) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Product type and processing time are required",
      });
    }

    // 1. Find storage record
    const storageRecord = await MilkStorageRecord.findOne({
      batchId: batchCode,
    }).session(session);

    if (!storageRecord) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Selected milk batch is not available in Raw Milk Storage",
      });
    }

    // 2. Deduct Raw Materials from inventory if used
    for (const item of rawMaterialsUsed) {
      if (!item.material || item.quantityUsed == null || item.quantityUsed <= 0) continue;

      const rawMat = await RawMaterial.findOne({
        material: new RegExp(`^${item.material.trim()}$`, "i"),
      }).session(session);

      if (rawMat) {
        rawMat.availableQuantity = Math.max(0, rawMat.availableQuantity - Number(item.quantityUsed));
        rawMat.lastUsed = new Date();
        await rawMat.save({ session });
      }
    }

    // 3. Generate Processing Batch ID: MP-YYYYMMDD-XXX
    const parsedDate = processingDate ? new Date(processingDate) : new Date();
    const processingId = await generateSequenceId("MP", parsedDate);

    // 4. Create Processing record
    const processingRecord = new Processing({
      processingId,
      milkBatchId: storageRecord.milkBatchId,
      inputMilkBatch: storageRecord.batchId,
      milkType: storageRecord.milkType.replace(/ Milk$/i, ""),
      inputQuantity: inQty,
      processingDate: parsedDate,
      processingTime: processingTime.trim(),
      productType: productType.trim(),
      outputQuantity: outQty,
      outputUnit: outputUnit === "Kg" ? "Kg" : "L",
      rawMaterialsUsed: rawMaterialsUsed
        .filter((m) => m.material && Number(m.quantityUsed) > 0)
        .map((m) => ({
          material: m.material.trim(),
          quantityUsed: Number(m.quantityUsed),
        })),
      byProducts: byProducts
        .filter((b) => b.byProduct && Number(b.quantity) > 0)
        .map((b) => ({
          byProduct: b.byProduct.trim(),
          quantity: Number(b.quantity),
          unit: b.unit === "Kg" ? "Kg" : "L",
        })),
      remarks: remarks || "",
    });

    await processingRecord.save({ session });

    // 5. Automatically add Finished Product to Finished Goods Inventory
    await FinishedProduct.create(
      [
        {
          product: productType.trim(),
          quantity: outQty,
          snapshotQuantity: outQty,
          unit: outputUnit === "Kg" ? "Kg" : "L",
          processingBatch: processingId,
          isByProduct: false,
          lastUpdated: new Date(),
        },
      ],
      { session }
    );

    // 6. Automatically add By-Products to Finished Goods Inventory
    if (byProducts && byProducts.length > 0) {
      const byProductDocs = byProducts
        .filter((bp) => bp.byProduct && Number(bp.quantity) > 0)
        .map((bp) => ({
          product: bp.byProduct.trim(),
          quantity: Number(bp.quantity),
          snapshotQuantity: Number(bp.quantity),
          unit: bp.unit === "Kg" ? "Kg" : "L",
          processingBatch: processingId,
          isByProduct: true,
          lastUpdated: new Date(),
        }));

      if (byProductDocs.length > 0) {
        await FinishedProduct.insertMany(byProductDocs, { session });
      }
    }

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Processing batch saved successfully",
      batch: processingRecord,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Create processing batch error:", error.message);
    return res.status(500).json({
      message: "Failed to save processing batch: " + error.message,
    });
  }
};

// GET /api/processing
const getAllProcessingBatches = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const query = Processing.find().sort({ createdAt: -1 }).lean();

    if (limit && !Number.isNaN(limit) && limit > 0) {
      query.limit(limit);
    }

    const batches = await query.exec();

    return res.status(200).json({
      count: batches.length,
      batches,
    });
  } catch (error) {
    console.error("Get processing batches error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch processing batches",
    });
  }
};

// GET /api/processing/:id
const getProcessingBatchById = async (req, res) => {
  try {
    const batch = await Processing.findById(req.params.id);

    if (!batch) {
      return res.status(404).json({ message: "Processing batch not found" });
    }

    return res.status(200).json({ batch });
  } catch (error) {
    return res.status(400).json({ message: "Invalid processing batch ID" });
  }
};

// PUT /api/processing/:id
const updateProcessingBatch = async (req, res) => {
  try {
    const { remarks, processingDate, processingTime } = req.body;

    const batch = await Processing.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({ message: "Processing batch not found" });
    }

    if (remarks !== undefined) batch.remarks = remarks;
    if (processingDate) batch.processingDate = new Date(processingDate);
    if (processingTime) batch.processingTime = processingTime.trim();

    await batch.save();

    return res.status(200).json({
      message: "Processing batch updated successfully",
      batch,
    });
  } catch (error) {
    console.error("Update processing batch error:", error.message);
    return res.status(500).json({ message: "Failed to update processing batch" });
  }
};

// DELETE /api/processing/:id
const deleteProcessingBatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const batch = await Processing.findById(req.params.id).session(session);
    if (!batch) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Processing batch not found" });
    }

    const hasDispatches = await Dispatch.exists({
      processingBatchId: batch.processingId,
    });

    if (hasDispatches) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({
        message:
          "Finished products from this batch have already been dispatched and cannot be deleted.",
      });
    }

    // 1. Revert raw materials used
    for (const item of batch.rawMaterialsUsed) {
      await RawMaterial.findOneAndUpdate(
        { material: new RegExp(`^${item.material}$`, "i") },
        { $inc: { availableQuantity: item.quantityUsed } },
        { session }
      );
    }

    // 2. Remove finished products created from inventory
    await FinishedProduct.deleteMany(
      { processingBatch: batch.processingId },
      { session }
    );

    // 3. Delete processing record
    await batch.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Processing batch deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Delete processing batch error:", error.message);
    return res.status(500).json({
      message: "Failed to delete processing batch",
    });
  }
};

module.exports = {
  getAvailableStorageBatches,
  createProcessingBatch,
  getAllProcessingBatches,
  getProcessingBatchById,
  updateProcessingBatch,
  deleteProcessingBatch,
};
