// Single source of truth for app branding.
// Edit values here, then run `node build-manifest.mjs` to regenerate manifest.json.
// (The app shell reads this file at runtime; the manifest is a static JSON file
// that browsers fetch directly, so it needs to be written to disk.)

export const config = {
  appName: "Decode",
  appShortName: "Decode",
  themeColor: "#0f0f0f",
  backgroundColor: "#0f0f0f",

  // Icons. Defaults to a single SVG, which modern PWA spec accepts via sizes:"any".
  // To use PNG instead: drop icon-192.png + icon-512.png into ./icons/ and replace
  // the array below with:
  //   icons: [
  //     { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png" },
  //     { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png" },
  //   ]
  icons: [
    { src: "./icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
  ],
};
