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
  shareLink: $("shareLink"),
  clear: $("clear"),
  status: $("status"),
};

let mode = "encrypt"; // "encrypt" | "decrypt"
let modeLocked = false; // true once user manually toggles; Clear resets it
let busy = false;

// Privacy auto-clear. Decrypted plaintext is the sensitive payload: it shows
// briefly, then wipes on a short countdown. Encrypted output is not sensitive,
// so it stays until the user copies it, at which point the app wipes at once.
// Either way we also wipe instantly when the tab is hidden or window blurred.
const DECRYPT_CLEAR_SECONDS = 4;
let countdownTimer = null;

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
  // Editing the message means the user is back at work; stop any pending wipe.
  cancelCountdown();
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
  // Share link only makes sense for ciphertext output. Hide for decrypt to
  // avoid embedding plaintext in a URL.
  els.shareLink.hidden = mode !== "encrypt";
}

function hideOutput() {
  els.output.hidden = true;
  els.outputText.value = "";
  els.shareLink.hidden = true;
}

async function run() {
  if (busy) return;
  cancelCountdown();
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
    if (mode === "decrypt") {
      // Plaintext on screen: start the short wipe countdown right away.
      startCountdown("Decrypted.", DECRYPT_CLEAR_SECONDS);
    } else {
      setStatus("Encrypted.", "ok");
    }
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
  } catch {
    // Fallback for non-secure contexts
    els.outputText.select();
    document.execCommand("copy");
  }
  // Encrypted output: once it's on the clipboard, wipe the app immediately.
  // Decrypted output: leave the running countdown to finish the job.
  if (mode === "encrypt") {
    clearAll();
    setStatus("Copied. Cleared for privacy.", "info");
  }
}

async function copyShareLink() {
  const cipher = els.outputText.value;
  if (!cipher) return;
  const url =
    location.origin +
    location.pathname +
    "#cipher=" +
    encodeURIComponent(cipher);
  try {
    await navigator.clipboard.writeText(url);
    clearAll();
    setStatus("Share link copied. Cleared for privacy.", "info");
  } catch {
    setStatus("Couldn't copy link. Use the Copy button instead.", "error");
  }
}

function clearAll() {
  cancelCountdown();
  els.input.value = "";
  els.key.value = "";
  hideOutput();
  setStatus("");
  modeLocked = false;
  setMode("encrypt");
  els.input.focus();
}

function cancelCountdown() {
  if (countdownTimer) {
    clearInterval(countdownTimer);
    countdownTimer = null;
  }
}

// Start (or restart) a countdown. Ticks the status line down to zero, then
// wipes everything.
function startCountdown(label, seconds) {
  cancelCountdown();
  let remaining = seconds;
  setStatus(`${label} Clearing in ${remaining}s for privacy.`, "ok");
  countdownTimer = setInterval(() => {
    remaining -= 1;
    if (remaining <= 0) {
      clearAll();
      setStatus("Cleared for privacy.", "info");
      return;
    }
    setStatus(`${label} Clearing in ${remaining}s for privacy.`, "ok");
  }, 1000);
}

// Wipe immediately when the user navigates away: tab hidden, or window blurred.
// Skip the no-op case so returning to an already-empty app isn't noisy.
function clearOnLeave() {
  const hasContent =
    els.input.value || els.key.value || !els.output.hidden;
  if (!hasContent) return;
  clearAll();
  setStatus("Cleared for privacy when you left the tab.", "info");
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
  els.shareLink.addEventListener("click", copyShareLink);
  els.clear.addEventListener("click", clearAll);
  els.toggleKey.addEventListener("click", toggleKeyVisibility);
  els.modeToggle.addEventListener("click", toggleMode);
  els.key.addEventListener("keydown", (e) => {
    if (e.key === "Enter") run();
  });

  // Wipe the instant the app is no longer in front of the user.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearOnLeave();
  });
  window.addEventListener("blur", clearOnLeave);
}

// Two ways a message can arrive without typing: a URL like
// /#cipher=<base64> (manually-crafted "share link"), or the Web Share Target
// API (which always uses ?text=<base64>). Read either, prefill, then strip
// the URL so it doesn't linger in the address bar or reload state.
function prefillFromUrl() {
  let payload = null;
  if (location.hash.length > 1) {
    const params = new URLSearchParams(location.hash.slice(1));
    payload = params.get("cipher");
  }
  if (!payload && location.search.length > 1) {
    const params = new URLSearchParams(location.search.slice(1));
    payload = params.get("text") || params.get("cipher");
  }
  if (!payload) return;

  els.input.value = payload;
  autoDetect();
  history.replaceState(null, "", location.pathname);
  els.key.focus();
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  // Don't await; fire and forget.
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

applyPersonalisation();
wire();
setMode("encrypt");
prefillFromUrl();
registerServiceWorker();
