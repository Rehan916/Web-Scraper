const { connectToDatabase } = require("../lib/db");

module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      message: "Method not allowed"
    });
  }

  try {
    await connectToDatabase();

    return res.status(200).json({
      ok: true,
      databaseConnected: true
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      databaseConnected: false,
      message: error.message
    });
  }
};
