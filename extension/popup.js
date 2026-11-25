// DrawScript 3D popup / options page. Every control saves instantly to chrome.storage.local.
(function () {
  "use strict";
  const DEFAULTS = {
    autoDraw: true, autoSend: true, ttsEnabled: true, voiceName: "", voiceRate: 1, voiceVolume: 1,
    speed: 1, theme: "dark", captions: true, overlayMode: "floating", level: "auto", length: "medium",
    subject: "any", language: "English", extra: "", dockCollapsed: false, dockSide: "right", appUrl: ""
  };
  const DEFAULT_APP_URL = "https://inaamshabir.github.io/drawScriptAI";
  const $ = (id) => document.getElementById(id);
  const msg = (t) => { $("msg").textContent = t; clearTimeout(msg.t); msg.t = setTimeout(() => ($("msg").textContent = ""), 2600); };
  if (new URLSearchParams(location.search).has("tab") || window.innerWidth > 500) document.body.classList.add("tab");
  let S = Object.assign({}, DEFAULTS);

  function fill() {
    for (const k in DEFAULTS) {
      const el = $(k);
      if (!el) continue;
      if (el.type === "checkbox") el.checked = !!S[k]; else el.value = String(S[k] == null ? "" : S[k]);
    }
    if (!$("appUrl").value) $("appUrl").placeholder = DEFAULT_APP_URL;
    $("rateV").textContent = Number(S.voiceRate).toFixed(1) + "×";
    $("volV").textContent = Math.round(Number(S.voiceVolume) * 100) + "%";
  }

  function fillVoices() {
    const sel = $("voiceName");
    const voices = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    sel.innerHTML = "";
    const d = document.createElement("option"); d.value = ""; d.textContent = "Browser default"; sel.appendChild(d);
    voices.forEach((v) => { const o = document.createElement("option"); o.value = v.name; o.textContent = v.name + " (" + v.lang + ")"; sel.appendChild(o); });
    sel.value = S.voiceName || "";
  }

  function save(key, value) {
    S[key] = value;
    try { chrome.storage.local.set({ [key]: value }); } catch (e) { /* ignore */ }
    $("rateV").textContent = Number(S.voiceRate).toFixed(1) + "×";
    $("volV").textContent = Math.round(Number(S.voiceVolume) * 100) + "%";
  }

  const NUMERIC = { speed: 1, voiceRate: 1, voiceVolume: 1 };
  document.querySelectorAll("input,select,textarea").forEach((el) => {
    const ev = el.type === "checkbox" || el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(ev, () => {
      if (!(el.id in DEFAULTS)) return;
      save(el.id, el.type === "checkbox" ? el.checked : (el.id in NUMERIC ? Number(el.value) : el.value.trim ? (el.id === "appUrl" ? el.value.trim() : el.value) : el.value));
    });
  });

  $("testVoice").addEventListener("click", () => {
    if (!window.speechSynthesis) return msg("Voice isn't supported in this browser");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Let us explore this idea step by step.");
    u.rate = Number(S.voiceRate) || 1; u.volume = Number(S.voiceVolume);
    const v = speechSynthesis.getVoices().find((x) => x.name === S.voiceName);
    if (v) u.voice = v;
    speechSynthesis.speak(u);
  });

  $("copyPrompt").addEventListener("click", () => {
    const text = window.DrawScriptPrompt.build("Explain the Pythagorean theorem visually.", S);
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
    ta.remove();
    if (ok) return msg("Prompt copied — paste it into ChatGPT or Claude");
    navigator.clipboard.writeText(text).then(() => msg("Prompt copied"), () => msg("Copy blocked"));
  });

  $("studio").addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "OPEN_DRAWSCRIPT_APP", script: "", source: "popup" });
  });

  $("draw").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const t = tabs && tabs[0];
      if (!t || !t.id) return msg("Open ChatGPT or Claude first");
      chrome.tabs.sendMessage(t.id, { type: "DRAW_NOW" }, () => {
        if (chrome.runtime.lastError) msg("Open a ChatGPT or Claude chat tab first");
        else { msg("Drawing on the page…"); if (document.body.classList.contains("tab") === false) setTimeout(() => window.close(), 400); }
      });
    });
  });

  $("reset").addEventListener("click", () => {
    S = Object.assign({}, DEFAULTS);
    try { chrome.storage.local.set(S); } catch (e) { /* ignore */ }
    fill(); fillVoices(); msg("Settings reset");
  });

  try { $("ver").textContent = "v" + chrome.runtime.getManifest().version; } catch (e) { /* ignore */ }

  chrome.storage.local.get(Object.keys(DEFAULTS), (res) => {
    S = Object.assign({}, DEFAULTS, res || {});
    fill(); fillVoices();
    if (window.speechSynthesis) speechSynthesis.onvoiceschanged = fillVoices;
  });
})();
