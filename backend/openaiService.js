const axios = require("axios");

async function generateMapping(profile, fields) {
  const prompt = `
You are an AI form filling assistant.

Match form fields with user profile data.

Return ONLY valid JSON:
{
  "field label": "value"
}

Profile:
${JSON.stringify(profile)}

Fields:
${JSON.stringify(fields)}
`;

  try {
    const response = await axios.post(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "http://localhost:5000",
          "X-Title": "AI Autofill Extension"
        }
      }
    );

    let text = response.data.choices[0].message.content;

    text = text.replace(/```json|```/g, "").trim();

    return JSON.parse(text);

  } catch (error) {
    console.error("OpenRouter Error:", error.response?.data || error.message);

    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = { generateMapping };