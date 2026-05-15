import {
  getEffective,
  savePersonalisation,
  resetPersonalisation,
  applyPersonalisation,
} from "./personalisation.js";

const MAX_ICON_BYTES = 256 * 1024;

const $ = (id) => document.getElementById(id);

const els = {
  openBtn: $("settingsBtn"),
  modal: $("settings"),
  form: $("settingsForm"),
  name: $("cfgName"),
  theme: $("cfgTheme"),
  bg: $("cfgBg"),
  iconPreview: $("iconPreview"),
  iconFile: $("iconFile"),
  iconPick: $("iconPickBtn"),
  iconClear: $("iconClearBtn"),
  status: $("settingsStatus"),
  reset: $("resetBtn"),
};

// Working draft — populated on open, mutated by user input, written on Save.
// We don't write straight to localStorage on every keystroke so Reset/Close
// without Save discards changes cleanly.
let draftIconDataUrl = null;
let draftIconType = null;
let savedToastTimer = null;

function setStatus(msg, kind = "info") {
  els.status.textContent = msg;
  els.status.dataset.kind = kind;
  clearTimeout(savedToastTimer);
  if (kind === "ok") {
    savedToastTimer = setTimeout(() => {
      if (els.status.textContent === msg) setStatus("");
    }, 2000);
  }
}

function loadFormFromEffective() {
  const eff = getEffective();
  els.name.value = eff.appName || "";
  els.theme.value = eff.themeColor || "#0f0f0f";
  els.bg.value = eff.backgroundColor || "#0f0f0f";
  draftIconDataUrl = eff.iconDataUrl;
  draftIconType = eff.iconType;
  els.iconPreview.src = eff.iconDataUrl || "./icons/icon.svg";
  setStatus("");
}

function openModal() {
  loadFormFromEffective();
  els.modal.hidden = false;
  // Focus after the modal is visible so screen readers announce it
  requestAnimationFrame(() => els.name.focus());
}

function closeModal() {
  els.modal.hidden = true;
  els.iconFile.value = "";
}

async function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("Read failed"));
    reader.readAsDataURL(file);
  });
}

async function onIconChosen(file) {
  if (!file) return;
  if (file.size > MAX_ICON_BYTES) {
    setStatus(`Icon too large (${(file.size / 1024).toFixed(0)} KB, max 256).`, "error");
    return;
  }
  try {
    const url = await readFileAsDataUrl(file);
    draftIconDataUrl = url;
    draftIconType = file.type || null;
    els.iconPreview.src = url;
    setStatus("Icon ready. Click Save to apply.", "info");
  } catch {
    setStatus("Couldn't read that file.", "error");
  }
}

function onIconClear() {
  draftIconDataUrl = null;
  draftIconType = null;
  els.iconPreview.src = "./icons/icon.svg";
  setStatus("Icon cleared. Click Save to apply.", "info");
}

function onSave(e) {
  e.preventDefault();
  const partial = {
    appName: els.name.value.trim() || null,
    themeColor: els.theme.value,
    backgroundColor: els.bg.value,
    iconDataUrl: draftIconDataUrl || null,
    iconType: draftIconType || null,
  };
  savePersonalisation(partial);
  applyPersonalisation();
  setStatus("Saved.", "ok");
}

function onReset() {
  resetPersonalisation();
  applyPersonalisation();
  loadFormFromEffective();
  setStatus("Reset to defaults.", "ok");
}

function wire() {
  els.openBtn.addEventListener("click", openModal);
  els.modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close]")) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.hidden) closeModal();
  });

  els.iconPick.addEventListener("click", () => els.iconFile.click());
  els.iconFile.addEventListener("change", (e) => onIconChosen(e.target.files?.[0]));
  els.iconClear.addEventListener("click", onIconClear);

  els.form.addEventListener("submit", onSave);
  els.reset.addEventListener("click", onReset);
}

wire();
