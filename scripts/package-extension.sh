#!/usr/bin/env bash
# Build a portable extension zip. Resolves the dev-only symlinks
# (extension/crypto.js -> shared/crypto.js, extension/icons -> icons) into
# real files so the package works when uploaded to the Chrome Web Store or
# loaded on a machine that doesn't have the rest of the repo.
set -euo pipefail

cd "$(dirname "$0")/.."

# Asset name stays version-less so the GitHub "releases/latest/download/..."
# URL is stable across releases. Version lives in the manifest and the tag.
OUT_DIR="dist"
PKG_DIR="${OUT_DIR}/extension"
ZIP_NAME="decode-extension.zip"
ZIP_PATH="${OUT_DIR}/${ZIP_NAME}"

rm -rf "$PKG_DIR" "$ZIP_PATH"
mkdir -p "$PKG_DIR/icons"

# Real files (cp dereferences symlinks by default)
cp extension/manifest.json "$PKG_DIR/"
cp extension/background.js "$PKG_DIR/"
cp extension/content.js    "$PKG_DIR/"
cp shared/crypto.js        "$PKG_DIR/crypto.js"
cp icons/icon.svg          "$PKG_DIR/icons/"

# Zip from inside dist/ so the archive root is the extension folder
( cd "$OUT_DIR" && zip -qr "$ZIP_NAME" extension )

echo "Wrote $ZIP_PATH"
echo "Contents:"
unzip -l "$ZIP_PATH" | sed 's/^/  /'
