require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");
const { seedRawMaterials } = require("./utils/seedRawMaterials");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET must be configured before starting the server");
  }

  await connectDB();
  await seedRawMaterials();

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
};

startServer();
