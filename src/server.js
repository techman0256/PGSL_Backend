require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { seedRawMaterials } = require("./utils/seedRawMaterials");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  await connectDB();
  await seedRawMaterials();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
