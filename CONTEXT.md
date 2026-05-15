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
