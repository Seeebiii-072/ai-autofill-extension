// FormGenius AI - Options Script (OpenRouter)

async function loadSettings() {
  const data = await chrome.storage.local.get("settings");
  const s = data.settings || {};

  if (s.apiKey) document.getElementById("apiKey").value = s.apiKey;
  if (s.model)  document.getElementById("model").value = s.model;
  if (s.reviewMode) document.getElementById("reviewMode").checked = true;
  if (s.multiStep !== undefined) document.getElementById("multiStep").checked = s.multiStep;
}

// ── Show / Hide key ──────────────────────────────────────────────
const showBtn  = document.getElementById("showKeyBtn");
const keyInput = document.getElementById("apiKey");

showBtn.addEventListener("click", () => {
  const hidden = keyInput.type === "password";
  keyInput.type = hidden ? "text" : "password";
  showBtn.textContent = hidden ? "hide" : "show";
});

// ── Test Key ─────────────────────────────────────────────────────
document.getElementById("testBtn").addEventListener("click", async () => {
  const key    = keyInput.value.trim();
  const model  = document.getElementById("model").value;
  const dot    = document.getElementById("testDot");
  const status = document.getElementById("testStatus");

  if (!key) {
    dot.style.background = "#ef4444";
    status.style.color   = "#ef4444";
    status.textContent   = "Enter an API key first.";
    return;
  }

  dot.style.background = "#f59e0b";
  status.style.color   = "#f59e0b";
  status.textContent   = "Testing connection...";

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${key}`,
        "HTTP-Referer": "https://formgenius.ai",
        "X-Title": "FormGenius AI Extension"
      },
      body: JSON.stringify({
        model,
        max_tokens: 10,
        messages: [{ role: "user", content: "Say OK" }]
      })
    });

    const data = await res.json();

    if (res.ok && data.choices?.[0]) {
      dot.style.background = "#10b981";
      dot.style.boxShadow  = "0 0 6px rgba(16,185,129,0.6)";
      status.style.color   = "#10b981";
      status.textContent   = `✓ Connected — model: ${model.split("/")[1]}`;
    } else {
      throw new Error(data.error?.message || `HTTP ${res.status}`);
    }
  } catch (err) {
    dot.style.background = "#ef4444";
    status.style.color   = "#ef4444";
    status.textContent   = `✗ ${err.message}`;
  }
});

// ── Save ─────────────────────────────────────────────────────────
document.getElementById("saveBtn").addEventListener("click", async () => {
  const apiKey     = keyInput.value.trim();
  const model      = document.getElementById("model").value;
  const reviewMode = document.getElementById("reviewMode").checked;
  const multiStep  = document.getElementById("multiStep").checked;
  const s = document.getElementById("saveStatus");

  if (!apiKey) {
    s.textContent = "⚠ OpenRouter API key is required.";
    s.className   = "save-status error";
    return;
  }

  await chrome.storage.local.set({ settings: { apiKey, model, reviewMode, multiStep } });

  s.textContent = "✓ Settings saved!";
  s.className   = "save-status success";
  setTimeout(() => { s.textContent = ""; s.className = "save-status"; }, 3000);
});

loadSettings();
