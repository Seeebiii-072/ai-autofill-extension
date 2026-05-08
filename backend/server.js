require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

// ROOT TEST
app.get("/", (req, res) => {
  res.send("AI Autofill Backend Running 🚀 (OpenRouter Mode)");
});

// SERVICE
const { generateMapping } = require("./openaiService");

// AI ROUTE
app.post("/ai/map", async (req, res) => {
  try {
    const { profile, fields } = req.body;

    const aiResponse = await generateMapping(profile, fields);

    res.json({
      success: true,
      aiResponse
    });

  } catch (err) {
    res.json({
      success: false,
      error: err.message
    });
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});