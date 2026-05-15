// Decode extension — background service worker.
// Registers the two context menu items, dispatches to the content script in
// the active tab, and handles crypto requests on its behalf (the SW is the
// only place we have ES-module imports, so crypto.js lives here).

import { encrypt, decrypt } from "./crypto.js";

const MENU_ENCRYPT = "decode-encrypt";
const MENU_DECRYPT = "decode-decrypt";

function registerMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ENCRYPT,
      title: "Encrypt with Decode",
      contexts: ["selection"],
    });
    chrome.contextMenus.create({
      id: MENU_DECRYPT,
      title: "Decrypt with Decode",
      contexts: ["selection"],
    });
  });
}

chrome.runtime.onInstalled.addListener(registerMenus);
chrome.runtime.onStartup.addListener(registerMenus);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  if (info.menuItemId !== MENU_ENCRYPT && info.menuItemId !== MENU_DECRYPT) return;
  const op = info.menuItemId === MENU_ENCRYPT ? "encrypt" : "decrypt";
  chrome.tabs.sendMessage(tab.id, {
    type: "decode:request",
    op,
    text: info.selectionText || "",
  });
});

// Crypto endpoint for content scripts. Content scripts can't import the
// module (manifest-injected scripts aren't loaded as modules in MV3), so they
// post here and wait for the result.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "decode:crypto") return false;
  (async () => {
    try {
      const result =
        msg.op === "encrypt"
          ? await encrypt(msg.text, msg.key)
          : await decrypt(msg.text, msg.key);
      sendResponse({ ok: true, result });
    } catch (e) {
      sendResponse({ ok: false, error: e?.message || "Crypto error" });
    }
  })();
  return true; // keep the channel open for the async response
});
