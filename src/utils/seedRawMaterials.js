const RawMaterial = require("../models/RawMaterial");

const defaultRawMaterials = [
  {
    material: "Citric Acid",
    availableQuantity: 1.5,
    unit: "Kg",
    lowStockThreshold: 2.0,
    lastUsed: new Date("2026-10-06T16:30:00"),
  },
  {
    material: "Starter Culture",
    availableQuantity: 250,
    unit: "g",
    lowStockThreshold: 500,
    lastUsed: new Date("2026-10-07T11:50:00"),
  },
  {
    material: "Salt",
    availableQuantity: 25,
    unit: "Kg",
    lowStockThreshold: 10,
    lastUsed: new Date("2026-10-06T15:15:00"),
  },
  {
    material: "Packaging Materials",
    availableQuantity: 8400,
    unit: "pcs",
    lowStockThreshold: 1000,
    lastUsed: new Date("2026-10-07T12:40:00"),
  },
];

const seedRawMaterials = async () => {
  try {
    const count = await RawMaterial.countDocuments();
    if (count === 0) {
      await RawMaterial.insertMany(defaultRawMaterials);
      console.log("Seeded initial raw materials successfully.");
    }
  } catch (error) {
    console.error("Error seeding raw materials:", error.message);
  }
};

module.exports = { seedRawMaterials };
