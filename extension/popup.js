// FormGenius AI - Popup Script

console.log("✅ FormGenius AI popup loaded");

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function setStatus(id, message, type = "") {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.className = `status-message ${type}`;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

// ─── TABS ─────────────────────────────────────────────────────────────────────

document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    tab.classList.add("active");
    document.getElementById(`tab-${tab.dataset.tab}`)?.classList.add("active");
  });
});

// ─── PROFILE LOAD ─────────────────────────────────────────────────────────────

async function loadProfile() {
  const data = await chrome.storage.local.get("profile");
  const profile = data.profile;

  if (profile) {
    const fields = ["name","firstName","lastName","email","phone","address","city",
                    "linkedin","website","role","company","yearsExp","skills","experience"];
    fields.forEach(key => {
      const el = document.getElementById(key);
      if (el && profile[key]) el.value = profile[key];
    });

    document.getElementById("statusDot").classList.add("ready");
    document.getElementById("statusText").textContent = `Profile ready · ${profile.name || ""}`;
  } else {
    document.getElementById("statusDot").classList.add("error");
    document.getElementById("statusText").textContent = "No profile — set up in Profile tab";
  }
}

// ─── SAVE PROFILE ─────────────────────────────────────────────────────────────

document.getElementById("saveBtn").addEventListener("click", async () => {
  const profile = {
    name: document.getElementById("name").value.trim(),
    firstName: document.getElementById("firstName").value.trim(),
    lastName: document.getElementById("lastName").value.trim(),
    email: document.getElementById("email").value.trim(),
    phone: document.getElementById("phone").value.trim(),
    address: document.getElementById("address").value.trim(),
    city: document.getElementById("city").value.trim(),
    linkedin: document.getElementById("linkedin").value.trim(),
    website: document.getElementById("website").value.trim(),
    role: document.getElementById("role").value.trim(),
    company: document.getElementById("company").value.trim(),
    yearsExp: document.getElementById("yearsExp").value.trim(),
    skills: document.getElementById("skills").value.trim(),
    experience: document.getElementById("experience").value.trim()
  };

  if (!profile.name && !profile.email) {
    setStatus("saveStatus", "Please fill in at least name and email.", "error");
    return;
  }

  await chrome.storage.local.set({ profile });

  setStatus("saveStatus", "✓ Profile saved successfully!", "success");
  document.getElementById("statusDot").className = "status-dot ready";
  document.getElementById("statusText").textContent = `Profile ready · ${profile.name}`;

  setTimeout(() => setStatus("saveStatus", ""), 3000);
});

// ─── DETECT FIELDS ────────────────────────────────────────────────────────────

document.getElementById("detectBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  try {
    const result = await chrome.tabs.sendMessage(tab.id, { action: "detectFields" });
    const count = result?.fields?.length || 0;
    document.getElementById("fieldCount").textContent = count;
    setStatus("fillStatus", `Found ${count} form fields on page`, "info");
    setTimeout(() => setStatus("fillStatus", ""), 3000);
  } catch (e) {
    document.getElementById("fieldCount").textContent = "?";
    setStatus("fillStatus", "Could not detect fields — try refreshing the page.", "error");
  }
});

// ─── FILL FORM ────────────────────────────────────────────────────────────────

async function triggerFill(reviewMode = false) {
  const tab = await getActiveTab();
  if (!tab?.id) return;

  const data = await chrome.storage.local.get(["profile", "settings"]);
  if (!data.profile?.name && !data.profile?.email) {
    setStatus("fillStatus", "Set up your profile first!", "error");
    document.querySelector('[data-tab="profile"]').click();
    return;
  }

  const settings = data.settings || {};
  if (!settings.apiKey) {
    setStatus("fillStatus", "Add your OpenRouter API key in Settings (⚙).", "error");
    return;
  }

  setStatus("fillStatus", "Sending to AI...", "info");

  try {
    await chrome.tabs.sendMessage(tab.id, { action: "fillForm", reviewMode });
    setStatus("fillStatus", reviewMode ? "Review overlay shown on page." : "Filling form...", "success");
    setTimeout(() => setStatus("fillStatus", ""), 3000);
  } catch (e) {
    setStatus("fillStatus", "Error: Could not reach the page. Try refreshing.", "error");
  }
}

document.getElementById("fillBtn").addEventListener("click", () => triggerFill(false));
document.getElementById("reviewBtn").addEventListener("click", () => triggerFill(true));

// ─── SETTINGS BUTTON ──────────────────────────────────────────────────────────

document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

// ─── SITE CONTEXT ─────────────────────────────────────────────────────────────

async function loadSiteContext() {
  const tab = await getActiveTab();
  const hostname = new URL(tab?.url || "https://unknown.com").hostname;
  document.getElementById("currentSite").textContent = hostname;

  const data = await chrome.storage.local.get("siteContexts");
  const contexts = data.siteContexts || {};
  document.getElementById("siteContext").value = contexts[hostname] || "";
}

document.getElementById("saveContextBtn").addEventListener("click", async () => {
  const tab = await getActiveTab();
  const hostname = new URL(tab?.url || "https://unknown.com").hostname;
  const context = document.getElementById("siteContext").value.trim();

  const data = await chrome.storage.local.get("siteContexts");
  const contexts = data.siteContexts || {};
  contexts[hostname] = context;
  await chrome.storage.local.set({ siteContexts: contexts });

  setStatus("contextStatus", "✓ Context saved for " + hostname, "success");
  setTimeout(() => setStatus("contextStatus", ""), 3000);
});

document.querySelectorAll(".preset-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("siteContext").value = btn.dataset.preset;
  });
});

// ─── SCAN FIELDS ON LOAD ──────────────────────────────────────────────────────

async function scanFieldsOnLoad() {
  const tab = await getActiveTab();
  if (!tab?.id) return;
  try {
    const result = await chrome.tabs.sendMessage(tab.id, { action: "detectFields" });
    const count = result?.fields?.length || 0;
    document.getElementById("fieldCount").textContent = count;
  } catch (e) {
    document.getElementById("fieldCount").textContent = "—";
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", async () => {
  await loadProfile();
  await loadSiteContext();
  await scanFieldsOnLoad();
});
