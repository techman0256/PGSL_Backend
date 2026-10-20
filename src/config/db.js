const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const { DB_USER, DB_PASSWORD } = process.env;

    
    const uri = `mongodb+srv://${DB_USER}:${DB_PASSWORD}`;

    await mongoose.connect(uri);
    console.log("MongoDB Atlas connected successfully");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;