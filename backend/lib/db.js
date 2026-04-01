const mongoose = require("mongoose");

let cachedConnectionPromise = null;

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
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
  return mongoose.connection;
}

module.exports = {
  connectToDatabase
};
