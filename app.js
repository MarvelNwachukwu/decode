import { encrypt, decrypt, looksLikeCiphertext } from "./shared/crypto.js";
import { applyPersonalisation } from "./personalisation.js";
import "./settings.js";

const $ = (id) => document.getElementById(id);

const els = {
  input: $("input"),
  key: $("key"),
  toggleKey: $("toggleKey"),
  action: $("action"),
  modeToggle: $("modeToggle"),
  modeOpts: document.querySelectorAll("#modeToggle .mode-opt"),
  output: $("output"),
  outputText: $("outputText"),
  copy: $("copy"),
  clear: $("clear"),
  status: $("status"),
};

let mode = "encrypt"; // "encrypt" | "decrypt"
let modeLocked = false; // true once user manually toggles; Clear resets it
let busy = false;

function setMode(next) {
  mode = next;
  for (const opt of els.modeOpts) {
    opt.classList.toggle("active", opt.dataset.mode === next);
  }
  els.action.textContent = next === "encrypt" ? "Encrypt" : "Decrypt";
  els.modeToggle.setAttribute(
    "aria-label",
    next === "encrypt"
      ? "Mode: encrypt. Switch to decrypt."
      : "Mode: decrypt. Switch to encrypt.",
  );
}

function toggleMode() {
  modeLocked = true;
  setMode(mode === "encrypt" ? "decrypt" : "encrypt");
}

function autoDetect() {
  if (modeLocked) return;
  setMode(looksLikeCiphertext(els.input.value) ? "decrypt" : "encrypt");
}

function setStatus(msg, kind = "info") {
  els.status.textContent = msg;
  els.status.dataset.kind = kind;
}

function showOutput(text) {
  els.outputText.value = text;
  els.output.hidden = false;
}

function hideOutput() {
  els.output.hidden = true;
  els.outputText.value = "";
}

async function run() {
  if (busy) return;
  const text = els.input.value.trim();
  const password = els.key.value;
  if (!text) {
    setStatus("Paste something first.", "error");
    return;
  }
  if (!password) {
    setStatus("Enter a key.", "error");
    els.key.focus();
    return;
  }

  busy = true;
  els.action.disabled = true;
  setStatus(mode === "encrypt" ? "Encrypting…" : "Decrypting…");

  try {
    const result =
      mode === "encrypt"
        ? await encrypt(text, password)
        : await decrypt(text, password);
    showOutput(result);
    setStatus(mode === "encrypt" ? "Encrypted." : "Decrypted.", "ok");
  } catch (err) {
    hideOutput();
    setStatus(err.message || "Something went wrong.", "error");
  } finally {
    busy = false;
    els.action.disabled = false;
  }
}

async function copyOutput() {
  const text = els.outputText.value;
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    setStatus("Copied.", "ok");
  } catch {
    // Fallback for non-secure contexts
    els.outputText.select();
    document.execCommand("copy");
    setStatus("Copied.", "ok");
  }
}

function clearAll() {
  els.input.value = "";
  els.key.value = "";
  hideOutput();
  setStatus("");
  modeLocked = false;
  setMode("encrypt");
  els.input.focus();
}

function toggleKeyVisibility() {
  const isPw = els.key.type === "password";
  els.key.type = isPw ? "text" : "password";
  els.toggleKey.setAttribute("aria-pressed", String(isPw));
  els.toggleKey.textContent = isPw ? "Hide" : "Show";
}

function wire() {
  els.input.addEventListener("input", autoDetect);
  els.action.addEventListener("click", run);
  els.copy.addEventListener("click", copyOutput);
  els.clear.addEventListener("click", clearAll);
  els.toggleKey.addEventListener("click", toggleKeyVisibility);
  els.modeToggle.addEventListener("click", toggleMode);
  els.key.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Don't await — fire and forget.
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

applyPersonalisation();
wire();
setMode("encrypt");
registerServiceWorker();
