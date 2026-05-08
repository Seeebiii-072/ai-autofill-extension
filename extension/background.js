// FormGenius AI - Background Service Worker

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.type === "GET_PROFILE") {
    chrome.storage.local.get(["profile"], (res) => {
      sendResponse(res.profile || null);
    });
    return true;
  }

  if (req.type === "GET_SETTINGS") {
    chrome.storage.local.get(["settings"], (res) => {
      sendResponse(res.settings || { reviewMode: false, apiKey: "", model: "openai/gpt-4o-mini" });
    });
    return true;
  }

  if (req.type === "GET_SITE_CONTEXT") {
    chrome.storage.local.get(["siteContexts"], (res) => {
      const contexts = res.siteContexts || {};
      const hostname = req.hostname;
      sendResponse(contexts[hostname] || "");
    });
    return true;
  }

  if (req.type === "AI_MAP_FIELDS") {
    handleAIMapping(req.payload).then(sendResponse).catch(err => {
      sendResponse({ error: err.message });
    });
    return true;
  }

  return true;
});

async function handleAIMapping({ profile, fields, siteContext, apiKey, model }) {
  const key = apiKey || "";
  if (!key) {
    throw new Error("No API key configured. Please add your OpenRouter API key in the extension settings.");
  }

  const fieldDescriptions = fields.map((f, i) =>
    `${i + 1}. label="${f.label}" name="${f.name}" placeholder="${f.placeholder}" type="${f.type}"`
  ).join("\n");

  const siteContextNote = siteContext ? `\nSite-specific context: ${siteContext}` : "";

  const prompt = `You are an expert form-filling assistant. Given a user profile and a list of form fields detected on a webpage, return a JSON mapping of each field's selector key to the best matching value from the profile.

User Profile:
${JSON.stringify(profile, null, 2)}
${siteContextNote}

Detected Form Fields:
${fieldDescriptions}

Rules:
- Return ONLY valid JSON, no markdown, no explanation
- Keys must be the field index (1, 2, 3...) as strings
- Values must be strings taken from the profile
- If a field doesn't match any profile data, omit it from the result
- For "experience" or "about" fields, write a professional 2-3 sentence summary
- For name fields, use full name unless it's specifically "first" or "last"
- For phone, use the stored phone number
- Infer intelligently: "mobile" = phone, "surname" = lastName, "city" = extract from address if available

Return JSON only:`;

  // ── OpenRouter API (OpenAI-compatible format) ──
  const selectedModel = model || "openai/gpt-4o-mini";

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${key}`,
      "HTTP-Referer": "https://formgenius.ai",
      "X-Title": "FormGenius AI Extension"
    },
    body: JSON.stringify({
      model: selectedModel,
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error?.message || `OpenRouter API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "{}";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    return { mapping: JSON.parse(clean), fields };
  } catch (e) {
    throw new Error("Failed to parse AI response as JSON");
  }
}
