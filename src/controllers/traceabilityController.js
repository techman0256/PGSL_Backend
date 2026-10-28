const mongoose = require("mongoose");
const MilkBatch = require("../models/MilkBatch");
const MilkQualityTest = require("../models/MilkQualityTest");
const MilkStorageRecord = require("../models/MilkStorageRecord");
const Processing = require("../models/Processing");
const FinishedProduct = require("../models/FinishedProduct");
const Dispatch = require("../models/Dispatch");

const toNumber = (value) => {
  if (value == null) return 0;
  return Number(value.toString());
};

const stageStatus = (record) => (record ? "completed" : "pending");

const getTraceability = async (req, res) => {
  try {
    const batch = await MilkBatch.findOne({ milkBatchId: req.params.batchId }).lean();

    if (!batch) {
      return res.status(404).json({ message: "Milk reception batch not found" });
    }

    const [qualityTest, storageRecord] = await Promise.all([
      MilkQualityTest.findOne({ milkBatchId: batch._id }).lean(),
      MilkStorageRecord.findOne({ milkBatchId: batch._id }).lean(),
    ]);

    const processingQuery = {
      $or: [
        { milkBatchId: batch._id },
        { inputMilkBatch: batch.milkBatchId },
      ],
    };
    const processingBatches = await Processing.find(processingQuery)
      .sort({ processingDate: 1, processingTime: 1 })
      .lean();
    const processingIds = processingBatches.map((item) => item.processingId);
    const processingObjectIds = processingBatches.map((item) => item._id);

    const finishedProducts = processingObjectIds.length > 0
      ? await FinishedProduct.find({
          $or: [
            { processingId: { $in: processingObjectIds } },
            { processingBatch: { $in: processingIds } },
          ],
        })
          .sort({ createdAt: 1 })
          .lean()
      : [];
    const finishedProductIds = finishedProducts.map((item) => item._id);

    const dispatches = finishedProductIds.length > 0
      ? await Dispatch.find({
          $or: [
            { finishedProductId: { $in: finishedProductIds } },
            { processingBatchId: { $in: processingIds } },
          ],
        })
          .sort({ dispatchDate: 1, dispatchTime: 1 })
          .lean()
      : [];

    const nodes = [];
    const edges = [];
    const rootId = `milk-${batch.milkBatchId}`;

    nodes.push({
      id: rootId,
      type: "milkReception",
      label: "Milk Reception",
      batchId: batch.milkBatchId,
      milkType: batch.milkType,
      quantity: toNumber(batch.quantity),
      unit: "L",
      receivedAt: batch.receivedAt,
      shift: batch.shift,
      status: "completed",
    });

    if (qualityTest) {
      const id = `quality-${qualityTest._id}`;
      nodes.push({
        id,
        type: "qualityTest",
        label: "Quality Testing",
        fat: qualityTest.fat,
        snf: qualityTest.snf,
        temperature: qualityTest.temperature,
        testDate: qualityTest.testDate,
        testTime: qualityTest.testTime,
        remarks: qualityTest.remarks,
        status: "completed",
      });
      edges.push({ from: rootId, to: id, relationship: "tested" });
    }

    if (storageRecord) {
      const id = `storage-${storageRecord._id}`;
      nodes.push({
        id,
        type: "storage",
        label: "Raw Milk Storage",
        batchId: storageRecord.batchId,
        quantity: storageRecord.quantity,
        unit: "L",
        siloNumber: storageRecord.siloNumber,
        temperature: storageRecord.storageTemperature,
        storageDate: storageRecord.storageDate,
        storageTime: storageRecord.storageTime,
        status: "completed",
      });
      edges.push({ from: rootId, to: id, relationship: "stored" });
    }

    processingBatches.forEach((processing) => {
      const processingNodeId = `processing-${processing.processingId}`;
      nodes.push({
        id: processingNodeId,
        type: "processing",
        label: "Processing",
        batchId: processing.processingId,
        product: processing.productType,
        inputQuantity: processing.inputQuantity,
        outputQuantity: processing.outputQuantity,
        unit: processing.outputUnit,
        processingDate: processing.processingDate,
        processingTime: processing.processingTime,
        remarks: processing.remarks,
        status: "completed",
      });

      const storageNode = storageRecord ? `storage-${storageRecord._id}` : rootId;
      edges.push({
        from: storageNode,
        to: processingNodeId,
        relationship: "processed",
        quantity: processing.inputQuantity,
      });

      finishedProducts
        .filter((product) =>
          (product.processingId && String(product.processingId) === String(processing._id)) ||
          product.processingBatch === processing.processingId
        )
        .forEach((product) => {
          const productNodeId = `product-${product._id}`;
          nodes.push({
            id: productNodeId,
            type: product.isByProduct ? "byProduct" : "finishedProduct",
            label: product.isByProduct ? "By-product" : "Finished Product",
            product: product.product,
            quantity: product.quantity,
            snapshotQuantity: product.snapshotQuantity,
            unit: product.unit,
            processingBatch: product.processingBatch,
            isByProduct: product.isByProduct,
            status: product.quantity > 0 ? "available" : "depleted",
          });
          edges.push({
            from: processingNodeId,
            to: productNodeId,
            relationship: product.isByProduct ? "produced-by-product" : "produced",
            quantity: product.snapshotQuantity,
          });

          dispatches
            .filter((dispatch) =>
              (dispatch.finishedProductId && String(dispatch.finishedProductId) === String(product._id)) ||
              (dispatch.processingBatchId === product.processingBatch && dispatch.product === product.product)
            )
            .forEach((dispatch) => {
              const dispatchNodeId = `dispatch-${dispatch._id}`;
              nodes.push({
                id: dispatchNodeId,
                type: "dispatch",
                label: "Dispatch",
                dispatchId: dispatch.dispatchId,
                quantity: dispatch.quantity,
                unit: dispatch.unit,
                customer: dispatch.customer,
                channel: dispatch.channel,
                dispatchDate: dispatch.dispatchDate,
                dispatchTime: dispatch.dispatchTime,
                status: "completed",
              });
              edges.push({
                from: productNodeId,
                to: dispatchNodeId,
                relationship: "dispatched",
                quantity: dispatch.quantity,
              });
            });
        });
    });

    const warnings = [];
    const inputQuantity = processingBatches.reduce(
      (total, item) => total + Number(item.inputQuantity || 0),
      0
    );
    const dispatchedQuantity = dispatches.reduce(
      (total, item) => total + Number(item.quantity || 0),
      0
    );
    if (storageRecord && inputQuantity > Number(storageRecord.quantity)) {
      warnings.push({
        code: "PROCESSING_EXCEEDS_STORAGE",
        message: "Processing input quantity is greater than the stored quantity.",
      });
    }

    return res.status(200).json({
      rootBatch: {
        id: batch.milkBatchId,
        milkType: batch.milkType,
        quantity: toNumber(batch.quantity),
        unit: "L",
        receivedAt: batch.receivedAt,
        shift: batch.shift,
      },
      summary: {
        qualityTestCompleted: Boolean(qualityTest),
        storageCompleted: Boolean(storageRecord),
        processingBatchCount: processingBatches.length,
        finishedProductCount: finishedProducts.length,
        dispatchCount: dispatches.length,
        inputQuantity,
        outputQuantity: processingBatches.reduce(
          (total, item) => total + Number(item.outputQuantity || 0),
          0
        ),
        dispatchedQuantity,
      },
      stages: {
        qualityTest: qualityTest ? { ...qualityTest, status: stageStatus(qualityTest) } : null,
        storage: storageRecord ? { ...storageRecord, status: stageStatus(storageRecord) } : null,
        processing: processingBatches,
        products: finishedProducts,
        dispatches,
      },
      nodes,
      edges,
      warnings,
    });
  } catch (error) {
    console.error("Get batch traceability error:", error.message);
    if (error instanceof mongoose.Error.CastError) {
      return res.status(400).json({ message: "Invalid batch traceability request" });
    }
    return res.status(500).json({ message: "Failed to fetch batch traceability" });
  }
};

module.exports = { getTraceability };
