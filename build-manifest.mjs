// Regenerate manifest.json from config.js.
// Run when you change appName, colors, or icons in config.js:
//   node build-manifest.mjs
//
// The app shell reads config.js at runtime, but the manifest is fetched by
// browsers as a static JSON file, so it has to live on disk separately.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { config } from "./config.js";

const here = dirname(fileURLToPath(import.meta.url));

const manifest = {
  name: config.appName,
  short_name: config.appShortName,
  start_url: "./",
  scope: "./",
  display: "standalone",
  orientation: "portrait",
  theme_color: config.themeColor,
  background_color: config.backgroundColor,
  icons: config.icons,
};

const out = resolve(here, "manifest.json");
writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
console.log(`Wrote ${out}`);
