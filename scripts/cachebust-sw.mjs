// Rewrites the `CACHE` constant in sw.js with the deployment's git SHA so any
// change to a precached shell asset (app.js, styles.css, etc.) triggers the
// service worker update cycle on existing PWA installs. Run by Vercel as the
// build step (see vercel.json) on every deploy.
//
// Locally: harmless to run, but the file gets modified in your working tree.
// `git checkout sw.js` reverts.

import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(here, "..", "sw.js");

function shortSha() {
  if (process.env.VERCEL_GIT_COMMIT_SHA) {
    return process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 8);
  }
  try {
    return execSync("git rev-parse --short=8 HEAD").toString().trim();
  } catch {
    return "dev-" + Date.now().toString(36);
  }
}

const sha = shortSha();
const original = readFileSync(swPath, "utf8");
const updated = original.replace(
  /const CACHE = "[^"]*";/,
  `const CACHE = "decode-${sha}";`,
);

if (updated === original) {
  console.error("Could not find the CACHE constant in sw.js. Aborting.");
  process.exit(1);
}

writeFileSync(swPath, updated);
console.log(`Bumped CACHE to decode-${sha}`);
