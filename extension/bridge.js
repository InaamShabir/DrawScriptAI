// DrawScript 3D Web App Bridge
(function () {
  function forwardScript(script, source) {
    if (!script) return;
    window.postMessage(
      {
        type: "DRAWSCRIPT_LOAD_SCRIPT",
        script,
        source: source || "chrome-extension"
      },
      "*"
    );
  }

  chrome.storage.local.get(["pendingScript"], (res) => {
    const pending = res.pendingScript;
    if (pending && pending.script && Date.now() - pending.timestamp < 120000) {
      setTimeout(() => {
        forwardScript(pending.script, pending.source);
        chrome.storage.local.remove("pendingScript");
      }, 400);
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "DELIVER_DRAWSCRIPT" && msg.script) {
      forwardScript(msg.script, msg.source);
      chrome.storage.local.remove("pendingScript");
    }
  });
})();
