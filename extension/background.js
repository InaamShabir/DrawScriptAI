// DrawScript 3D background service worker
const DEFAULT_APP_URL = "https://inaamshabir.github.io/drawScriptAI";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message) return;

  if (message.type === "OPEN_OPTIONS") {
    chrome.runtime.openOptionsPage();
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "OPEN_LAB") {
    chrome.tabs.create({ url: chrome.runtime.getURL("lab.html" + (message.id ? "?id=" + encodeURIComponent(message.id) : "")) });
    sendResponse({ ok: true });
    return;
  }

  if (message.type === "OPEN_DRAWSCRIPT_APP") {
    const script = message.script || "";
    const source = message.source || "chatgpt";
    chrome.storage.local.get(["appUrl"], (res) => {
      const baseUrl = ((res.appUrl || "").trim() || DEFAULT_APP_URL).replace(/\/+$/, "");
      chrome.storage.local.set({ pendingScript: script ? { script, source, timestamp: Date.now() } : null }, () => {
        chrome.tabs.query({}, (tabs) => {
          const existing = tabs.find((t) => t.url && t.url.startsWith(baseUrl));
          if (existing && existing.id) {
            chrome.tabs.update(existing.id, { active: true });
            if (script) chrome.tabs.sendMessage(existing.id, { type: "DELIVER_DRAWSCRIPT", script, source }, () => void chrome.runtime.lastError);
            sendResponse({ ok: true, reusedTab: true });
          } else {
            const encoded = encodeURIComponent(script);
            const url = script && encoded.length < 12000 ? baseUrl + "/#drawscript=" + encoded : baseUrl;
            chrome.tabs.create({ url });
            sendResponse({ ok: true, reusedTab: false });
          }
        });
      });
    });
    return true;
  }
});
