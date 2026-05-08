// FormGenius AI - Content Script
// Handles field detection, form filling, multi-step support, and review overlay

console.log("✅ FormGenius AI content script loaded");

// ─── FIELD DETECTION ────────────────────────────────────────────────────────

function getVisibleInputs() {
  const selector = "input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]):not([type=file]):not([type=image]), textarea, select";
  return [...document.querySelectorAll(selector)].filter(el => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 &&
      style.visibility !== "hidden" &&
      style.display !== "none" &&
      style.opacity !== "0";
  });
}

function getLabelText(el) {
  // Try explicit label
  if (el.id) {
    const label = document.querySelector(`label[for="${el.id}"]`);
    if (label) return label.innerText.trim();
  }
  // Try wrapping label
  const parent = el.closest("label");
  if (parent) return parent.innerText.trim();
  // Try aria-label
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();
  // Try aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const labelEl = document.getElementById(labelledBy);
    if (labelEl) return labelEl.innerText.trim();
  }
  // Try placeholder
  if (el.placeholder) return el.placeholder.trim();
  // Try name
  if (el.name) return el.name.replace(/[_\-]/g, " ").trim();
  // Try nearest preceding text
  const preceding = getPrecedingText(el);
  if (preceding) return preceding;

  return "unknown";
}

function getPrecedingText(el) {
  let node = el.previousSibling;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
      return node.textContent.trim();
    }
    if (node.nodeType === Node.ELEMENT_NODE) {
      const text = node.innerText?.trim();
      if (text && text.length < 100) return text;
    }
    node = node.previousSibling;
  }
  // Check parent's preceding siblings
  const parentPrev = el.parentElement?.previousElementSibling;
  if (parentPrev) {
    const text = parentPrev.innerText?.trim();
    if (text && text.length < 100) return text;
  }
  return "";
}

function getUniqueSelector(el, index) {
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.getAttribute("aria-label")) return `[aria-label="${el.getAttribute("aria-label")}"]`;
  if (el.name) return `[name="${el.name}"]`;
  // Fallback: index-based
  return `__fg_index_${index}`;
}

function detectAllFields() {
  const inputs = getVisibleInputs();
  return inputs.map((el, i) => ({
    index: i + 1,
    label: getLabelText(el),
    name: el.name || "",
    placeholder: el.placeholder || "",
    type: el.type || el.tagName.toLowerCase(),
    selector: getUniqueSelector(el, i),
    element: el // keep reference for direct use
  }));
}

// ─── FORM FILLING ───────────────────────────────────────────────────────────

function injectValue(el, value) {
  if (!el || value === undefined || value === null || value === "") return false;

  const tagName = el.tagName.toLowerCase();

  if (tagName === "select") {
    // Try to match by value or text
    const options = [...el.options];
    const match = options.find(o =>
      o.value.toLowerCase() === value.toLowerCase() ||
      o.text.toLowerCase().includes(value.toLowerCase())
    );
    if (match) {
      el.value = match.value;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  if (el.type === "checkbox" || el.type === "radio") {
    const shouldCheck = ["yes", "true", "1", "on"].includes(value.toLowerCase());
    if (el.type === "radio" && el.value.toLowerCase() === value.toLowerCase()) {
      el.checked = true;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } else if (el.type === "checkbox") {
      el.checked = shouldCheck;
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }
    return false;
  }

  // Standard text input / textarea
  // Use native setter for React compatibility
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype, "value"
  )?.set;
  const nativeTextareaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, "value"
  )?.set;

  if (tagName === "textarea" && nativeTextareaSetter) {
    nativeTextareaSetter.call(el, value);
  } else if (nativeInputValueSetter) {
    nativeInputValueSetter.call(el, value);
  } else {
    el.value = value;
  }

  // Dispatch events for React/Vue/Angular
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true }));

  return true;
}

function fillFields(mapping, fields) {
  let filled = 0;
  const inputs = getVisibleInputs();

  fields.forEach(field => {
    const value = mapping[String(field.index)];
    if (!value) return;

    let el = null;

    // Try by index reference first
    if (field.index - 1 < inputs.length) {
      el = inputs[field.index - 1];
    }

    // Fallback: try selector
    if (!el && field.selector && !field.selector.startsWith("__fg_index_")) {
      el = document.querySelector(field.selector);
    }

    if (el && injectValue(el, value)) {
      filled++;
      // Visual highlight
      el.style.transition = "box-shadow 0.3s ease, border-color 0.3s ease";
      el.style.boxShadow = "0 0 0 2px #6366f1, 0 0 12px rgba(99,102,241,0.3)";
      el.style.borderColor = "#6366f1";
      setTimeout(() => {
        el.style.boxShadow = "";
        el.style.borderColor = "";
      }, 2500);
    }
  });

  return filled;
}

// ─── MULTI-STEP FORM SUPPORT ─────────────────────────────────────────────────

let stepObserver = null;
let pendingMapping = null;
let pendingFields = null;

function observeFormChanges(mapping, fields) {
  pendingMapping = mapping;
  pendingFields = fields;

  if (stepObserver) stepObserver.disconnect();

  stepObserver = new MutationObserver(() => {
    // Check if new inputs appeared
    const newInputs = getVisibleInputs();
    if (newInputs.length > 0) {
      setTimeout(() => {
        const newFields = detectAllFields();
        const unfilled = newFields.filter(f => {
          const val = mapping[String(f.index)];
          const el = getVisibleInputs()[f.index - 1];
          return val && el && !el.value;
        });
        if (unfilled.length > 0) {
          fillFields(mapping, newFields);
          showToast(`Filled ${unfilled.length} new fields on next step ✓`);
        }
      }, 600);
    }
  });

  stepObserver.observe(document.body, { childList: true, subtree: true });

  // Auto-disconnect after 5 minutes
  setTimeout(() => stepObserver?.disconnect(), 5 * 60 * 1000);
}

// ─── REVIEW OVERLAY ──────────────────────────────────────────────────────────

function showReviewOverlay(mapping, fields, onConfirm) {
  // Remove existing overlay
  document.getElementById("fg-review-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "fg-review-overlay";
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
    z-index: 2147483647; display: flex; align-items: center; justify-content: center;
    font-family: 'Segoe UI', system-ui, sans-serif;
  `;

  const panel = document.createElement("div");
  panel.style.cssText = `
    background: #0f0f13; color: #e2e8f0; border-radius: 16px;
    border: 1px solid #2d2d3d; padding: 28px; max-width: 560px; width: 90%;
    max-height: 80vh; overflow-y: auto; box-shadow: 0 25px 60px rgba(0,0,0,0.5);
  `;

  const mappedFields = fields.filter(f => mapping[String(f.index)]);

  panel.innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; margin-bottom:20px;">
      <div style="width:32px;height:32px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px;">✦</div>
      <div>
        <h2 style="margin:0;font-size:18px;font-weight:700;color:#fff;">Review Before Fill</h2>
        <p style="margin:0;font-size:12px;color:#6b7280;">${mappedFields.length} fields will be filled</p>
      </div>
    </div>
    <div id="fg-review-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
      ${mappedFields.map(f => `
        <div style="background:#1a1a24;border-radius:10px;padding:12px;border:1px solid #2d2d3d;">
          <div style="font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:4px;">${f.label}</div>
          <div style="font-size:14px;color:#a5b4fc;">${mapping[String(f.index)]}</div>
        </div>
      `).join("")}
    </div>
    <div style="display:flex;gap:10px;">
      <button id="fg-review-cancel" style="flex:1;padding:12px;background:#1a1a24;border:1px solid #2d2d3d;border-radius:10px;color:#9ca3af;cursor:pointer;font-size:14px;font-weight:600;">Cancel</button>
      <button id="fg-review-confirm" style="flex:1;padding:12px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border:none;border-radius:10px;color:#fff;cursor:pointer;font-size:14px;font-weight:700;">Fill ${mappedFields.length} Fields ✓</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  document.getElementById("fg-review-cancel").onclick = () => overlay.remove();
  document.getElementById("fg-review-confirm").onclick = () => {
    overlay.remove();
    onConfirm();
  };

  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
}

// ─── TOAST NOTIFICATIONS ─────────────────────────────────────────────────────

function showToast(message, type = "success") {
  document.getElementById("fg-toast")?.remove();

  const toast = document.createElement("div");
  toast.id = "fg-toast";
  const colors = {
    success: "linear-gradient(135deg,#6366f1,#8b5cf6)",
    error: "linear-gradient(135deg,#ef4444,#dc2626)",
    info: "linear-gradient(135deg,#06b6d4,#0891b2)"
  };
  toast.style.cssText = `
    position: fixed; bottom: 24px; right: 24px; z-index: 2147483647;
    background: ${colors[type] || colors.success}; color: white;
    padding: 14px 20px; border-radius: 12px; font-size: 14px; font-weight: 600;
    font-family: 'Segoe UI', system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(99,102,241,0.4);
    animation: fg-slide-in 0.4s cubic-bezier(0.34,1.56,0.64,1);
    max-width: 320px;
  `;

  // Add animation styles
  if (!document.getElementById("fg-toast-styles")) {
    const style = document.createElement("style");
    style.id = "fg-toast-styles";
    style.textContent = `
      @keyframes fg-slide-in {
        from { transform: translateX(120%) scale(0.8); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes fg-slide-out {
        from { transform: translateX(0) scale(1); opacity: 1; }
        to { transform: translateX(120%) scale(0.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = "fg-slide-out 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showLoadingIndicator(message = "AI is analyzing fields...") {
  document.getElementById("fg-loading")?.remove();

  const loader = document.createElement("div");
  loader.id = "fg-loading";
  loader.style.cssText = `
    position: fixed; top: 20px; right: 20px; z-index: 2147483647;
    background: #0f0f13; border: 1px solid #2d2d3d; color: #a5b4fc;
    padding: 12px 18px; border-radius: 12px; font-size: 13px; font-weight: 600;
    font-family: 'Segoe UI', system-ui, sans-serif;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    display: flex; align-items: center; gap: 10px;
  `;
  loader.innerHTML = `
    <div style="width:16px;height:16px;border:2px solid #2d2d3d;border-top-color:#6366f1;border-radius:50%;animation:fg-spin 0.8s linear infinite;"></div>
    ${message}
    <style>@keyframes fg-spin{to{transform:rotate(360deg)}}</style>
  `;
  document.body.appendChild(loader);
  return loader;
}

// ─── MAIN AUTOFILL FLOW ──────────────────────────────────────────────────────

async function runAutoFill(reviewMode = false) {
  const loader = showLoadingIndicator("Detecting form fields...");

  try {
    // Get profile and settings
    const [profile, settings] = await Promise.all([
      new Promise(r => chrome.runtime.sendMessage({ type: "GET_PROFILE" }, r)),
      new Promise(r => chrome.runtime.sendMessage({ type: "GET_SETTINGS" }, r))
    ]);

    if (!profile || !profile.name) {
      loader.remove();
      showToast("⚠ No profile saved. Open the extension to set up your profile.", "error");
      return;
    }

    // Get site context
    const hostname = window.location.hostname;
    const siteContext = await new Promise(r =>
      chrome.runtime.sendMessage({ type: "GET_SITE_CONTEXT", hostname }, r)
    );

    // Detect fields
    const fields = detectAllFields();
    const fieldsWithoutEl = fields.map(({ element, ...rest }) => rest);

    if (fieldsWithoutEl.length === 0) {
      loader.remove();
      showToast("No form fields found on this page.", "info");
      return;
    }

    loader.remove();
    const loader2 = showLoadingIndicator(`AI mapping ${fieldsWithoutEl.length} fields...`);

    // Ask background to do AI mapping
    const result = await new Promise(r =>
      chrome.runtime.sendMessage({
        type: "AI_MAP_FIELDS",
        payload: {
          profile,
          fields: fieldsWithoutEl,
          siteContext,
          apiKey: settings?.apiKey || "",
          model: settings?.model || "openai/gpt-4o-mini"
        }
      }, r)
    );

    loader2.remove();

    if (result.error) {
      showToast(`❌ ${result.error}`, "error");
      return;
    }

    const { mapping } = result;
    const mappedCount = Object.keys(mapping).length;

    if (mappedCount === 0) {
      showToast("AI found no matching fields for your profile.", "info");
      return;
    }

    const doFill = () => {
      const filled = fillFields(mapping, fields);
      showToast(`✦ FormGenius filled ${filled} fields successfully!`);
      // Set up multi-step observer
      observeFormChanges(mapping, fields);
    };

    const useReviewMode = reviewMode || settings?.reviewMode;

    if (useReviewMode) {
      showReviewOverlay(mapping, fields, doFill);
    } else {
      doFill();
    }

  } catch (err) {
    document.getElementById("fg-loading")?.remove();
    showToast(`❌ Error: ${err.message}`, "error");
    console.error("FormGenius error:", err);
  }
}

// ─── MESSAGE LISTENER ────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "fillForm") {
    runAutoFill(msg.reviewMode || false);
    sendResponse({ ok: true });
  }
  if (msg.action === "detectFields") {
    const fields = detectAllFields().map(({ element, ...rest }) => rest);
    sendResponse({ fields });
  }
  return true;
});
