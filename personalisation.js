import { config } from "./config.js";

// localStorage key for the personalisation blob.
const LS_KEY = "decode:personalisation";

// Current Blob URL for the dynamic manifest, kept so we can revoke it on
// subsequent updates to avoid leaking object URLs.
let activeManifestUrl = null;

// Read raw personalisation overrides from localStorage. Returns {} if absent
// or unparseable.
export function getPersonalisation() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// Effective config = deployment defaults from config.js overlaid by
// localStorage personalisation. Pure; no DOM side-effects.
export function getEffective() {
  const p = getPersonalisation();
  const appName = p.appName || config.appName;
  return {
    appName,
    appShortName: p.appShortName || appName || config.appShortName,
    themeColor: p.themeColor || config.themeColor,
    backgroundColor: p.backgroundColor || config.backgroundColor,
    iconDataUrl: p.iconDataUrl || null,
    iconType: p.iconType || null,
  };
}

// Merge partial overrides into existing personalisation. Pass null for a key
// to clear that specific override.
export function savePersonalisation(partial) {
  const current = getPersonalisation();
  const next = { ...current };
  for (const [k, v] of Object.entries(partial)) {
    if (v === null || v === undefined || v === "") delete next[k];
    else next[k] = v;
  }
  localStorage.setItem(LS_KEY, JSON.stringify(next));
}

export function resetPersonalisation() {
  localStorage.removeItem(LS_KEY);
}

function buildManifest(eff) {
  const icons = eff.iconDataUrl
    ? [
        {
          src: eff.iconDataUrl,
          sizes: "any",
          type: eff.iconType || "image/png",
          purpose: "any maskable",
        },
      ]
    : config.icons;

  return {
    name: eff.appName,
    short_name: eff.appShortName,
    start_url: "./",
    scope: "./",
    display: "standalone",
    orientation: "portrait",
    theme_color: eff.themeColor,
    background_color: eff.backgroundColor,
    icons,
    share_target: {
      action: "./",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: { text: "text" },
    },
  };
}

function setMeta(name, value) {
  let el = document.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
}

function setLink(rel, href, type) {
  let el = document.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
  if (type) el.setAttribute("type", type);
}

// Apply the current effective config to the DOM. Safe to call repeatedly.
export function applyPersonalisation() {
  const eff = getEffective();

  // Title (used by iOS A2HS in absence of apple-mobile-web-app-title)
  document.title = eff.appName;
  setMeta("apple-mobile-web-app-title", eff.appName);

  // Theme color: meta tag tints browser chrome (URL bar, installed PWA title
  // bar), and --theme drives in-page accents like focus borders. The CSS var
  // is only set when the user has actually personalised it, so the default
  // accent in styles.css survives a Reset.
  setMeta("theme-color", eff.themeColor);
  document.documentElement.style.setProperty("--bg", eff.backgroundColor);
  const userTheme = getPersonalisation().themeColor;
  if (userTheme) {
    document.documentElement.style.setProperty("--theme", userTheme);
  } else {
    document.documentElement.style.removeProperty("--theme");
  }

  // App-name text in the header, if present
  const h = document.getElementById("appName");
  if (h) h.textContent = eff.appName;

  // Icons: apple-touch-icon for iOS, manifest icons for Android/desktop.
  const iconHref = eff.iconDataUrl || config.icons[0]?.src || "./icons/icon.svg";
  const iconType = eff.iconDataUrl
    ? eff.iconType
    : config.icons[0]?.type || "image/svg+xml";
  setLink("apple-touch-icon", iconHref);
  setLink("icon", iconHref, iconType);

  // Manifest: rewrite to a Blob URL so Android picks up personalised values
  // when the user taps "Add to Home Screen".
  const manifest = buildManifest(eff);
  const blob = new Blob([JSON.stringify(manifest)], { type: "application/manifest+json" });
  const url = URL.createObjectURL(blob);
  if (activeManifestUrl) URL.revokeObjectURL(activeManifestUrl);
  activeManifestUrl = url;
  setLink("manifest", url);
}
