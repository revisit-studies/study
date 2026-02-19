(() => {
  const STORE_KEY = "rrnl_answer_store_v1";

  const log = (...args) =>
    console.log("%c[rrnl-tracker]", "color:#2563eb;font-weight:600", ...args);
  const warn = (...args) =>
    console.warn("%c[rrnl-tracker]", "color:#dc2626;font-weight:600", ...args);

  log("Script loaded");

  function norm(s) {
    return (s ?? "").toString().replace(/\s+/g, " ").trim();
  }

  function getComponentNameFromUrl() {
    try {
      const url = new URL(window.location.href);
      const file = url.pathname.split("/").pop() || "";
      const name = file.replace(/\.html?$/i, "");
      log("Detected component name from URL:", name);
      return name || null;
    } catch (e) {
      warn("Failed to parse component name from URL", e);
      return null;
    }
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return { version: 1, answers: {} };
      const parsed = JSON.parse(raw);
      if (!parsed.answers) parsed.answers = {};
      return parsed;
    } catch {
      return { version: 1, answers: {} };
    }
  }

  function saveStore(store) {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }

  async function fetchConfig() {
    log("Fetching config.json…");
    const res = await fetch("../config.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    log("Loaded config.json successfully. Keys:", Object.keys(json || {}));
    return json;
  }

  function getParentDocument() {
    try {
      const doc = window.parent.document;
      doc.querySelector("body"); // force security check
      log("Successfully accessed parent document ✅");
      return doc;
    } catch (e) {
      warn(
        "❌ Cannot access parent document. You need iframe sandbox allow-same-origin.",
        e
      );
      return null;
    }
  }

  // Build prompt -> responseId mapping using YOUR schema:
  // config.components[componentName].response: [{ id, prompt, ... }]
  function buildPromptMapFromComponents(config, componentName) {
    const map = new Map();

    const comps = config?.components;
    if (!comps || typeof comps !== "object") {
      warn("config.components missing or not an object");
      return map;
    }

    const comp = comps[componentName];
    if (!comp) {
      warn("Component not found in config.components:", componentName);
      log("Available component keys sample:", Object.keys(comps).slice(0, 25));
      return map;
    }

    const resp = comp.response;
    if (!Array.isArray(resp)) {
      warn("Component response missing or not an array:", componentName, comp);
      return map;
    }

    for (const r of resp) {
      const prompt = norm(r?.prompt);
      const id = r?.id;
      if (prompt && id) {
        map.set(prompt, id);
        log("Mapped prompt → id:", prompt, "→", id);
      }
    }

    log(`Total mapped prompts for ${componentName}:`, map.size);
    return map;
  }

  // Find controls in parent (sidebar) - same heuristic as before
  function findControls(parentDoc) {
    const controls = Array.from(
      parentDoc.querySelectorAll(
        "input, textarea, select, [role='spinbutton'], [contenteditable='true']"
      )
    ).filter((el) => {
      const rect = el.getBoundingClientRect?.();
      return !rect || (rect.width > 0 && rect.height > 0);
    });

    log("Found potential sidebar controls:", controls.length);
    return controls;
  }

  function readValue(el) {
    if (!el) return null;

    if ("value" in el) {
      const v = el.value?.trim();
      return v || null;
    }

    if (el.getAttribute?.("contenteditable") === "true") {
      const t = norm(el.textContent);
      return t || null;
    }

    if (el.getAttribute?.("role") === "spinbutton") {
      const v = el.getAttribute("aria-valuenow");
      return v || null;
    }

    return null;
  }

  function extractLabel(el, parentDoc) {
    // best case: aria-label
    let label = el.getAttribute?.("aria-label");

    // label for=
    if (!label && el.id) {
      const l = parentDoc.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (l) label = l.textContent;
    }

    // closest label wrapper
    if (!label) {
      const lab = el.closest?.("label");
      if (lab) label = lab.textContent;
    }

    // fallback: nearby container text
    if (!label) {
      const wrapper = el.closest?.("div, section, article");
      if (wrapper) label = wrapper.textContent;
    }

    return norm(label);
  }

  function matchResponseId(promptMap, label) {
    if (!label) return null;

    // Exact match first
    for (const [prompt, id] of promptMap.entries()) {
      if (label === prompt) return id;
    }

    // Contains fallback
    for (const [prompt, id] of promptMap.entries()) {
      if (label.includes(prompt) || prompt.includes(label)) return id;
    }

    return null;
  }

  async function main() {
    log("Tracker main() starting");

    const componentName = getComponentNameFromUrl();
    if (!componentName) return;

    const parentDoc = getParentDocument();
    if (!parentDoc) return;

    let config;
    try {
      config = await fetchConfig();
    } catch (e) {
      warn("Failed to load config.json", e);
      return;
    }

    const promptMap = buildPromptMapFromComponents(config, componentName);
    if (!promptMap.size) {
      warn("No prompts mapped — tracker will not record answers");
      return;
    }

    const store = loadStore();

    function scanAndSave() {
      log("Scanning sidebar for answers…");
      const controls = findControls(parentDoc);

      let saves = 0;
      let matched = 0;

      for (const el of controls) {
        const label = extractLabel(el, parentDoc);
        if (!label) continue;

        const responseId = matchResponseId(promptMap, label);
        if (!responseId) continue;
        matched++;

        const value = readValue(el);
        if (value == null) continue;

        if (!store.answers[componentName]) store.answers[componentName] = {};
        store.answers[componentName][responseId] = value;
        saves++;

        log("✅ Saved answer:", { componentName, responseId, value });
      }

      if (matched === 0) warn("No sidebar labels matched prompts for this component.");
      if (saves > 0) {
        saveStore(store);
        log(`Saved ${saves} value(s) to localStorage key ${STORE_KEY}`);
      } else {
        log("No values saved this scan");
      }
    }

    // Run once immediately
    scanAndSave();

    // Observe UI changes
    const observer = new MutationObserver(() => {
      log("Sidebar DOM mutation detected");
      scanAndSave();
    });

    observer.observe(parentDoc.body, { subtree: true, childList: true, attributes: true });

    // Fallback periodic scan
    setInterval(scanAndSave, 2000);

    log("Tracker initialized ✅");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
