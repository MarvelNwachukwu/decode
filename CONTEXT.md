# Decode: Context

A client-side PWA for symmetric encrypt/decrypt of messages between two parties.
No backend, no storage of message data or keys. Everything happens in the browser.

## Glossary

### Deployment config

The values committed in `config.js` at the repo root. Affects every user of the
deployed app. Source of truth for branding (appName, colors, icons) and crypto
defaults (PBKDF2 iterations). Changing it requires editing the file and
redeploying; the manifest is regenerated via `node build-manifest.mjs`.

### Personalisation

Per-device, per-browser overrides stored in `localStorage`, layered on top of
deployment config at runtime. Modified via the in-app Settings UI.

The product purpose is **disguise**: lets the user make the installed PWA look
like something innocuous (e.g. "Notes" with a notepad icon) on their phone's
home screen, so a casual onlooker can't tell what the app is. To make the
disguise reach the home screen and not just the running tab, JS rewrites the
DOM (`document.title`, `apple-mobile-web-app-title`, `apple-touch-icon`, and a
Blob-URL manifest) on every load **before** "Add to Home Screen" is invoked.

Scope today is **launcher disguise only**: home-screen and "Add to Home
Screen" identity (name, icon, theme colors) is configurable per-device via the
Settings UI. The in-app UI is unchanged: opening the disguised app still
shows the regular Decode interface. **Full camouflage** (a credible fake app
in notes/calculator/etc. form, gated by a secret unlock) is deferred to v2.

### Chrome extension

A separate companion Chrome browser extension (distinct from "chrome" in the
UI sense). Lets users right-click a text selection on any webpage and pick
"Encrypt with Decode" or "Decrypt with Decode". Prompts for the key and
returns the result.

### URL-hash prefill

Visiting a URL with a `#cipher=<base64>` hash opens the app with the message
pre-filled and the key input focused. Used by the in-app "Share link" button,
which generates these URLs after an encrypt. The hash is stripped via
`history.replaceState` once read, so it doesn't linger in the address bar or
get re-applied on refresh. Keys are never included in URLs.

### Web Share Target

The PWA registers as a system share target (Android, plus Chromium PWAs on
desktop). Sharing text from any app routes it to Decode as `?text=<text>`,
which is read at startup and treated the same as URL-hash prefill. The Web
Share Target spec allows one target per manifest, so encrypt-vs-decrypt is
auto-detected from the shared content's shape.

### Deploy and SW cache busting

Vercel auto-deploys on push to `main`. A pre-build step
(`scripts/cachebust-sw.mjs`, configured via `vercel.json`) rewrites the
`CACHE` constant in `sw.js` to `decode-<git-sha>` on every deploy. That
byte-change forces the service worker to update on existing PWA installs,
so shell asset changes (app.js, styles.css, index.html, the shared crypto
module, etc.) land for returning users on the next page load.

Contributors don't need to bump the cache version manually. The committed
value in `sw.js` is whatever the last local edit left it as; Vercel
overwrites it at deploy time.

## Non-goals

**Third-party LLM integration** (Claude skill, GPT plugin, MCP server hosted
by a model vendor, etc.). Anything that puts the key or plaintext into a
remote provider's request stream defeats the zero-trust principle, even
when the workflow would be convenient. Considered and rejected in 2026-05 on
the explicit grounds that the key would land in chat history and on a third
party's servers. The mobile-workflow problem stays solved by Decode-the-PWA,
not by routing through a model. Same crypto primitives as the web app.

### Mode

Whether the current action is `encrypt` or `decrypt`. Auto-detected from the
input on every keystroke unless the user clicks the header toggle, which locks
the choice until **Clear** is pressed.
