// DrawScript 3D Background Service Worker
const DEFAULT_APP_URL = "https://inaamshabir.github.io/drawScriptAI";

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(["drawscriptAppUrl", "autoPlay", "ttsEnabled"], (res) => {
    chrome.storage.local.set({
      drawscriptAppUrl: res.drawscriptAppUrl || DEFAULT_APP_URL,
      autoPlay: res.autoPlay ?? false,
      ttsEnabled: res.ttsEnabled ?? true
    });
  });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "OPEN_DRAWSCRIPT_APP") {
    const script = message.script || "";
    const source = message.source || "chatgpt";

    chrome.storage.local.get(["drawscriptAppUrl"], (res) => {
      const baseUrl = (res.drawscriptAppUrl || DEFAULT_APP_URL).replace(/\/+$/, "");
      chrome.storage.local.set(
        {
          pendingScript: {
            script,
            source,
            timestamp: Date.now()
          }
        },
        () => {
          chrome.tabs.query({}, (tabs) => {
            const existing = tabs.find((t) => t.url && t.url.startsWith(baseUrl));
            if (existing && existing.id) {
              chrome.tabs.update(existing.id, { active: true });
              chrome.tabs
                .sendMessage(existing.id, {
                  type: "DELIVER_DRAWSCRIPT",
                  script,
                  source
                })
                .catch(() => {});
              sendResponse({ ok: true, reusedTab: true });
            } else {
              const encoded = encodeURIComponent(script);
              const targetUrl =
                encoded.length < 12000 ? `${baseUrl}/#drawscript=${encoded}` : baseUrl;
              chrome.tabs.create({ url: targetUrl });
              sendResponse({ ok: true, reusedTab: false });
            }
          });
        }
      );
    });
    return true;
  }
});
