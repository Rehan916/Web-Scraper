const mongoose = require("mongoose");
const Product = require("./product-model");

let cachedConnectionPromise = null;
let indexesSyncedPromise = null;

async function ensureIndexes() {
  if (!indexesSyncedPromise) {
    indexesSyncedPromise = Product.syncIndexes().catch((error) => {
      indexesSyncedPromise = null;
      throw error;
    });
  }

  return indexesSyncedPromise;
}

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    await ensureIndexes();
    return mongoose.connection;
  }

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing from environment variables.");
  }

  if (!cachedConnectionPromise) {
    cachedConnectionPromise = mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false
    });
  }

  await cachedConnectionPromise;
  await ensureIndexes();
  return mongoose.connection;
}

module.exports = {
  connectToDatabase
};
