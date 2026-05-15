# 0001 — Personalisation by runtime DOM rewrite (including a Blob-URL manifest)

Status: Accepted

## Context

The product needs to let each user disguise the installed PWA on their phone
(launcher name, icon, theme color) so a casual onlooker doesn't recognise it.
Two hard constraints frame the solution:

1. **No backend.** Per the spec, there is no server doing anything. So we can't
   serve a per-user manifest from a `/manifest?user=marvel` endpoint.
2. **Per-device disguise.** Marvellous's phone and James's phone need
   different disguises. So a single static `manifest.json` is also insufficient.

The installed PWA's home-screen identity is decided at "Add to Home Screen"
time and is read from:

- **iOS Safari:** `<title>` (or `apple-mobile-web-app-title` meta) + the
  `apple-touch-icon` link tag.
- **Android Chrome:** the manifest fetched via `<link rel="manifest">`.

`localStorage` alone reaches *neither* of these — it only affects the running
JS state.

## Decision

Personalisation lives in `localStorage`. On every page load, before any "Add
to Home Screen" prompt can be triggered, JS rewrites the DOM so the values
the browser captures at install time are the disguised ones:

- `document.title` → personalised app name.
- `<meta name="apple-mobile-web-app-title">` → personalised name (iOS).
- `<link rel="apple-touch-icon">` href → personalised icon, stored as a
  data URL.
- `<meta name="theme-color">` → personalised theme color.
- A fresh manifest object (built from current personalisation + deployment
  defaults from `config.js`) is serialized, wrapped in a `Blob` URL, and
  set as the href of `<link rel="manifest">` (Android).

The committed `manifest.json` stays in the repo with deployment defaults — it
is what first-time visitors and crawlers see before the rewrite runs.

## Consequences

- Disguise reaches the installed PWA's home-screen identity on both iOS and
  Android, without a backend.
- Each device's installed app can be disguised independently.
- The static `manifest.json` is still required as the first-load fallback and
  for cases where JS hasn't run yet.
- Clearing localStorage (or using a different browser/profile) reverts to the
  undisguised defaults. Users should be aware of this — it's actually a useful
  property (private browsing = "real" UI).
- Blob-URL manifests are well supported in Chromium-based browsers; iOS
  Safari uses the apple-* tags and largely ignores the manifest, so the
  iOS path is covered by the `apple-touch-icon` + title rewrite.

## Alternatives considered

- **Static manifest only.** Rejected — can't disguise per-device.
- **Per-user manifest from a server endpoint.** Rejected — violates the
  "no backend" constraint.
- **Skip the disguise.** Rejected — it's the stated product purpose.
