// Decode extension: content script.
// Receives "decode:request" messages from the background SW (sent in response
// to a context-menu click), shows an in-page modal to collect the key, and
// then either:
//   - decrypt: shows the plaintext inside the modal with a Copy button
//   - encrypt: tries to replace the selected text in place; otherwise copies
//              the ciphertext to the clipboard. Always also copies.
//
// All UI lives inside a closed Shadow DOM so the host page's styles can't
// reach our modal and ours can't leak out.

(() => {
  if (window.__decodeExtensionLoaded__) return;
  window.__decodeExtensionLoaded__ = true;

  let shadow = null;
  let hostEl = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "decode:request") return;
    handleRequest(msg.op, msg.text || "");
  });

  // ----- Editable-target capture --------------------------------------------
  // Captured at message-arrival time (selection is still live then), so we
  // can later try to replace it in place once the user submits a key.
  function captureTarget() {
    const ae = document.activeElement;
    if (
      ae &&
      (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") &&
      typeof ae.selectionStart === "number"
    ) {
      return {
        kind: "input",
        el: ae,
        start: ae.selectionStart,
        end: ae.selectionEnd,
      };
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
    const range = sel.getRangeAt(0);
    let node = range.commonAncestorContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentNode;
    const ce = node && node.closest("[contenteditable=''],[contenteditable='true']");
    if (ce) return { kind: "contenteditable", el: ce, range: range.cloneRange() };
    return null;
  }

  function tryReplace(target, text) {
    if (!target) return false;
    try {
      if (target.kind === "input") {
        target.el.focus();
        target.el.setSelectionRange(target.start, target.end);
        if (document.execCommand("insertText", false, text)) return true;
        // Direct fallback: dispatch input event so framework state updates.
        const val = target.el.value;
        target.el.value = val.slice(0, target.start) + text + val.slice(target.end);
        const caret = target.start + text.length;
        target.el.setSelectionRange(caret, caret);
        target.el.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      }
      if (target.kind === "contenteditable") {
        target.el.focus();
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(target.range);
        return !!document.execCommand("insertText", false, text);
      }
    } catch {
      return false;
    }
    return false;
  }

  // ----- Modal --------------------------------------------------------------
  function ensureModal() {
    if (shadow) return shadow;
    hostEl = document.createElement("div");
    hostEl.id = "decode-ext-host";
    hostEl.style.cssText = "all:initial;position:fixed;inset:0;z-index:2147483647;";
    shadow = hostEl.attachShadow({ mode: "closed" });
    shadow.innerHTML = MODAL_HTML;
    document.documentElement.appendChild(hostEl);

    shadow.addEventListener("click", (e) => {
      if (e.target.matches("[data-close]")) closeModal();
    });
    shadow.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
    });
    shadow.getElementById("toggleKey").addEventListener("click", () => {
      const i = shadow.getElementById("keyInput");
      const b = shadow.getElementById("toggleKey");
      const isPw = i.type === "password";
      i.type = isPw ? "text" : "password";
      b.textContent = isPw ? "Hide" : "Show";
    });
    return shadow;
  }

  function showModal() {
    ensureModal();
    hostEl.style.display = "block";
    resetModal();
  }

  function resetModal() {
    if (!shadow) return;
    shadow.getElementById("keyField").hidden = false;
    shadow.getElementById("resultField").hidden = true;
    shadow.getElementById("errorMsg").hidden = true;
    shadow.getElementById("keyInput").value = "";
    shadow.getElementById("resultText").value = "";
    shadow.getElementById("keyInput").type = "password";
    shadow.getElementById("toggleKey").textContent = "Show";
  }

  function closeModal() {
    if (hostEl) hostEl.style.display = "none";
  }

  function setError(msg) {
    if (!shadow) return;
    const err = shadow.getElementById("errorMsg");
    err.textContent = msg;
    err.hidden = false;
  }

  function setBusy(busy) {
    if (!shadow) return;
    shadow.getElementById("submitBtn").disabled = busy;
    shadow.getElementById("submitBtn").textContent = busy ? "Working…" : "Go";
  }

  function promptForKey(op) {
    return new Promise((resolve) => {
      ensureModal();
      const title = shadow.getElementById("modalTitle");
      const note = shadow.getElementById("modalNote");
      const submit = shadow.getElementById("submitBtn");
      const input = shadow.getElementById("keyInput");

      title.textContent = op === "encrypt" ? "Encrypt with Decode" : "Decrypt with Decode";
      note.textContent =
        op === "encrypt"
          ? "Enter the shared key. The ciphertext will replace your selection or be copied to your clipboard."
          : "Enter the shared key to reveal the plaintext.";

      const onSubmit = (e) => {
        e?.preventDefault();
        cleanup();
        resolve(input.value);
      };
      const onCancel = () => {
        cleanup();
        resolve(null);
      };
      const onKey = (e) => {
        if (e.key === "Enter") onSubmit(e);
      };
      const onClick = (e) => {
        if (e.target.matches("[data-close]")) onCancel();
      };
      function cleanup() {
        submit.removeEventListener("click", onSubmit);
        input.removeEventListener("keydown", onKey);
        shadow.removeEventListener("click", onClick);
      }
      submit.addEventListener("click", onSubmit);
      input.addEventListener("keydown", onKey);
      shadow.addEventListener("click", onClick);

      requestAnimationFrame(() => input.focus());
    });
  }

  function showResult(plaintext) {
    const keyField = shadow.getElementById("keyField");
    const resultField = shadow.getElementById("resultField");
    const resultText = shadow.getElementById("resultText");
    keyField.hidden = true;
    resultField.hidden = false;
    resultText.value = plaintext;
    resultText.focus();
    resultText.select();
  }

  function showToast(message) {
    const t = document.createElement("div");
    t.style.cssText = `
      all: initial;
      position: fixed;
      top: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #161616;
      color: #ededed;
      font: 13px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      padding: 10px 16px;
      border: 1px solid #262626;
      border-radius: 999px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      pointer-events: none;
      opacity: 0;
      transition: opacity 160ms ease, transform 160ms ease;
    `;
    t.textContent = message;
    document.documentElement.appendChild(t);
    requestAnimationFrame(() => {
      t.style.opacity = "1";
      t.style.transform = "translateX(-50%) translateY(4px)";
    });
    setTimeout(() => {
      t.style.opacity = "0";
      setTimeout(() => t.remove(), 200);
    }, 1800);
  }

  async function copyToClipboard(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to execCommand fallback
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:-1000px;left:-1000px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }

  // ----- Main flow ----------------------------------------------------------
  async function handleRequest(op, text) {
    if (!text) return; // shouldn't happen; context menu requires selection

    const target = captureTarget();
    showModal();
    const key = await promptForKey(op);
    if (key === null) {
      closeModal();
      return;
    }
    if (!key) {
      setError("Key required.");
      return;
    }

    setBusy(true);
    setError("");
    shadow.getElementById("errorMsg").hidden = true;

    let response;
    try {
      response = await chrome.runtime.sendMessage({
        type: "decode:crypto",
        op,
        text,
        key,
      });
    } catch (e) {
      setBusy(false);
      setError("Couldn't reach background. Try reloading the page.");
      return;
    }

    setBusy(false);

    if (!response?.ok) {
      setError(response?.error || "Something went wrong.");
      return;
    }

    if (op === "decrypt") {
      showResult(response.result);
      // Wire copy + done
      const copyBtn = shadow.getElementById("copyResultBtn");
      copyBtn.onclick = async () => {
        const ok = await copyToClipboard(response.result);
        copyBtn.textContent = ok ? "Copied" : "Copy failed";
        setTimeout(() => (copyBtn.textContent = "Copy"), 1200);
      };
    } else {
      closeModal();
      const replaced = tryReplace(target, response.result);
      const copied = await copyToClipboard(response.result);
      const msg = replaced
        ? copied
          ? "Encrypted: replaced selection, also copied."
          : "Encrypted: replaced selection."
        : copied
          ? "Encrypted: copied to clipboard."
          : "Encrypted: couldn't replace or copy. Result lost.";
      showToast(msg);
    }
  }

  // ----- HTML template ------------------------------------------------------
  const MODAL_HTML = `
    <style>
      :host { all: initial; }
      .backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.55);
        backdrop-filter: blur(2px);
      }
      .panel {
        position: fixed;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        width: min(520px, calc(100vw - 32px));
        max-height: 80vh;
        background: #161616;
        color: #ededed;
        border: 1px solid #262626;
        border-radius: 16px;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        animation: in 160ms ease-out;
      }
      @keyframes in {
        from { transform: translate(-50%, calc(-50% + 8px)); opacity: 0; }
        to   { transform: translate(-50%, -50%); opacity: 1; }
      }
      header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 14px 18px;
        border-bottom: 1px solid #262626;
      }
      .title {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: 0.02em;
      }
      .close, .ghost {
        background: transparent;
        color: #ededed;
        border: 1px solid #262626;
        border-radius: 10px;
        padding: 8px 12px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
      }
      .close:hover, .ghost:hover { background: #1a1a1a; border-color: #3a3a3a; }
      .body { padding: 18px; display: flex; flex-direction: column; gap: 14px; }
      .note {
        margin: 0;
        font-size: 13px;
        color: #8a8a8a;
        line-height: 1.45;
      }
      .field { display: flex; flex-direction: column; gap: 10px; }
      .lbl {
        font-size: 11px;
        color: #8a8a8a;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      }
      .key-row { display: flex; gap: 8px; }
      input[type="password"], input[type="text"], textarea {
        flex: 1;
        background: #1d1d1d;
        color: #ededed;
        border: 1px solid #262626;
        border-radius: 10px;
        padding: 12px 14px;
        font: inherit;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
        font-size: 14px;
        outline: none;
        resize: vertical;
      }
      input:focus, textarea:focus {
        border-color: #3a3a3a;
        background: #1f1f1f;
      }
      textarea { min-height: 120px; }
      .primary {
        background: #e8e8e8;
        color: #0f0f0f;
        border: 0;
        border-radius: 10px;
        padding: 12px 16px;
        font: inherit;
        font-weight: 500;
        cursor: pointer;
        min-height: 44px;
      }
      .primary:hover { background: #fff; }
      .primary:disabled { opacity: 0.6; cursor: not-allowed; }
      .row { display: flex; gap: 8px; }
      .row .primary { flex: 1; }
      .err {
        margin: 0;
        font-size: 13px;
        color: #ff8580;
        font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
      }
    </style>
    <div class="backdrop" data-close></div>
    <div class="panel" role="dialog" aria-modal="true">
      <header>
        <h2 id="modalTitle" class="title">Decode</h2>
        <button type="button" class="close" data-close>Close</button>
      </header>
      <div class="body">
        <p id="modalNote" class="note"></p>

        <div id="keyField" class="field">
          <label class="lbl" for="keyInput">Key</label>
          <div class="key-row">
            <input id="keyInput" type="password" autocomplete="off" spellcheck="false" />
            <button type="button" id="toggleKey" class="ghost">Show</button>
          </div>
          <button type="button" id="submitBtn" class="primary">Go</button>
          <p id="errorMsg" class="err" hidden></p>
        </div>

        <div id="resultField" class="field" hidden>
          <label class="lbl" for="resultText">Plaintext</label>
          <textarea id="resultText" readonly></textarea>
          <div class="row">
            <button type="button" id="copyResultBtn" class="primary">Copy</button>
            <button type="button" class="ghost" data-close>Done</button>
          </div>
        </div>
      </div>
    </div>
  `;
})();
