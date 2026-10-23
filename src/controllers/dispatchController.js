const mongoose = require("mongoose");
const Dispatch = require("../models/Dispatch");
const FinishedProduct = require("../models/FinishedProduct");
const { generateSequenceId } = require("../utils/idGenerator");

// GET /api/dispatches/available-products
// Returns products available in finished goods inventory with current available stock
const getAvailableProductsForDispatch = async (req, res) => {
  try {
    const products = await FinishedProduct.find({ quantity: { $gt: 0 } })
      .sort({ updatedAt: -1 })
      .lean();

    const formatted = products.map((p) => ({
      _id: p._id,
      product: p.product,
      processingBatchId: p.processingBatch,
      snapshotQuantity: p.snapshotQuantity,
      availableQuantity: p.quantity,
      unit: p.unit,
      displaySnapshot: `${p.snapshotQuantity} ${p.unit} in snapshot · ${p.quantity} ${p.unit} available`,
    }));

    return res.status(200).json({
      count: formatted.length,
      products: formatted,
    });
  } catch (error) {
    console.error("Get available products for dispatch error:", error.message);
    return res.status(500).json({
      message: "Failed to fetch available products for dispatch",
    });
  }
};

// POST /api/dispatches
const createDispatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      product,
      processingBatchId,
      quantity,
      unit,
      customer,
      channel,
      dispatchDate,
      dispatchTime,
    } = req.body;

    const dispatchQty = Number(quantity);

    if (!dispatchQty || dispatchQty <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Quantity must be greater than zero" });
    }

    if (!customer?.trim() || !channel || !dispatchTime) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Customer, channel and dispatch time are required",
      });
    }

    const validChannels = ["Retail", "Wholesale", "Distributor"];
    if (!validChannels.includes(channel)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Channel must be Retail, Wholesale, or Distributor",
      });
    }

    // 1. Locate Finished Product
    let finishedProduct;
    if (product && processingBatchId) {
      finishedProduct = await FinishedProduct.findOne({
        product: new RegExp(`^${product.trim()}$`, "i"),
        processingBatch: processingBatchId.trim(),
      }).session(session);
    }
    if (!finishedProduct && product) {
      finishedProduct = await FinishedProduct.findOne({
        product: new RegExp(`^${product.trim()}$`, "i"),
        quantity: { $gte: dispatchQty },
      })
        .sort({ createdAt: 1 })
        .session(session);
    }

    if (!finishedProduct) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Finished product not found in inventory or out of stock",
      });
    }

    if (finishedProduct.quantity < dispatchQty) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Insufficient inventory. Available: ${finishedProduct.quantity} ${finishedProduct.unit}, Requested: ${dispatchQty} ${finishedProduct.unit}`,
      });
    }

    // 2. Deduct from inventory
    finishedProduct.quantity -= dispatchQty;
    finishedProduct.lastUpdated = new Date();
    await finishedProduct.save({ session });

    // 3. Generate Dispatch ID: DS-YYYYMMDD-XXX
    const parsedDate = dispatchDate ? new Date(dispatchDate) : new Date();
    const dispatchId = await generateSequenceId("DS", parsedDate);

    // 4. Create Dispatch record
    const dispatchRecord = new Dispatch({
      dispatchId,
      product: finishedProduct.product,
      processingBatchId: finishedProduct.processingBatch,
      quantity: dispatchQty,
      unit: unit || finishedProduct.unit,
      customer: customer.trim(),
      channel,
      dispatchDate: parsedDate,
      dispatchTime: dispatchTime.trim(),
    });

    await dispatchRecord.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      message: "Dispatch created successfully",
      dispatch: dispatchRecord,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Create dispatch error:", error.message);
    return res.status(500).json({
      message: "Failed to create dispatch: " + error.message,
    });
  }
};

// GET /api/dispatches
const getAllDispatches = async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : undefined;
    const query = Dispatch.find().sort({ createdAt: -1 }).lean();

    if (limit && !Number.isNaN(limit) && limit > 0) {
      query.limit(limit);
    }

    const dispatches = await query.exec();

    return res.status(200).json({
      count: dispatches.length,
      dispatches,
    });
  } catch (error) {
    console.error("Get dispatches error:", error.message);
    return res.status(500).json({ message: "Failed to fetch dispatches" });
  }
};

// GET /api/dispatches/:id
const getDispatchById = async (req, res) => {
  try {
    const dispatch = await Dispatch.findById(req.params.id);

    if (!dispatch) {
      return res.status(404).json({ message: "Dispatch record not found" });
    }

    return res.status(200).json({ dispatch });
  } catch (error) {
    return res.status(400).json({ message: "Invalid dispatch ID" });
  }
};

// PUT /api/dispatches/:id
const updateDispatch = async (req, res) => {
  try {
    const { customer, channel, dispatchDate, dispatchTime } = req.body;

    const dispatch = await Dispatch.findById(req.params.id);
    if (!dispatch) {
      return res.status(404).json({ message: "Dispatch record not found" });
    }

    if (customer) dispatch.customer = customer.trim();
    if (channel) dispatch.channel = channel;
    if (dispatchDate) dispatch.dispatchDate = new Date(dispatchDate);
    if (dispatchTime) dispatch.dispatchTime = dispatchTime.trim();

    await dispatch.save();

    return res.status(200).json({
      message: "Dispatch updated successfully",
      dispatch,
    });
  } catch (error) {
    console.error("Update dispatch error:", error.message);
    return res.status(500).json({ message: "Failed to update dispatch" });
  }
};

// DELETE /api/dispatches/:id
const deleteDispatch = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const dispatch = await Dispatch.findById(req.params.id).session(session);
    if (!dispatch) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Dispatch record not found" });
    }

    // Restore inventory quantity
    await FinishedProduct.findOneAndUpdate(
      {
        product: dispatch.product,
        processingBatch: dispatch.processingBatchId,
      },
      {
        $inc: { quantity: dispatch.quantity },
        $set: { lastUpdated: new Date() },
      },
      { session }
    );

    await dispatch.deleteOne({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(200).json({
      message: "Dispatch deleted successfully",
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Delete dispatch error:", error.message);
    return res.status(500).json({ message: "Failed to delete dispatch" });
  }
};

module.exports = {
  getAvailableProductsForDispatch,
  createDispatch,
  getAllDispatches,
  getDispatchById,
  updateDispatch,
  deleteDispatch,
};
