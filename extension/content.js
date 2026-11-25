// DrawScript 3D v2 — content script for ChatGPT & Claude
(function () {
  "use strict";
  if (window.__ds3dLoaded) return;
  window.__ds3dLoaded = true;

  const DEFAULTS = {
    autoDraw: true,        // draw automatically when a DrawScript block finishes streaming
    autoSend: true,        // "Ask with DrawScript" also presses Send
    ttsEnabled: true,
    voiceName: "",
    voiceRate: 1,
    voiceVolume: 1,
    speed: 1,              // animation speed multiplier
    theme: "dark",         // dark | chalkboard | blueprint | paper
    captions: true,
    overlayMode: "floating", // floating | fullscreen
    level: "auto",
    length: "medium",
    subject: "any",
    language: "English",
    extra: "",
    dockCollapsed: false,
    dockSide: "right",     // right | left
    appUrl: ""
  };
  const THEMES = {
    dark: { bg: "#030712", filter: "" },
    chalkboard: { bg: "#17352b", filter: "" },
    blueprint: { bg: "#0a3566", filter: "" },
    paper: { bg: "#030712", filter: "invert(1) hue-rotate(180deg)" }
  };

  let S = Object.assign({}, DEFAULTS);
  let overlay = null, engine = null, dock = null;
  let currentScript = "";
  let waiting = false;          // an Ask was sent; draw when the reply finishes
  let lastDrawnSig = "";
  let primed = false;           // first scan done (existing replies are not auto-drawn)
  let debounce = null;
  let toastTimer = null;

  const repair = typeof window.DrawScriptRepair === "function" ? window.DrawScriptRepair : (t) => t;

  // ---------- settings ----------
  function loadSettings(cb) {
    try {
      chrome.storage.local.get(Object.keys(DEFAULTS), (res) => {
        S = Object.assign({}, DEFAULTS, res || {});
        // On a phone the dock starts as a small button so it never covers the chat.
        if (res && res.dockCollapsed === undefined && window.innerWidth < 640) S.dockCollapsed = true;
        cb && cb();
      });
    } catch (e) { cb && cb(); }
  }
  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      for (const k in changes) if (k in DEFAULTS) S[k] = changes[k].newValue === undefined ? DEFAULTS[k] : changes[k].newValue;
      applySettings();
    });
  } catch (e) { /* storage unavailable */ }

  function applySettings() {
    if (engine) applyEngineSettings();
    if (overlay) applyOverlaySettings();
    if (dock) applyDockSettings();
  }

  function applyEngineSettings() {
    const t = THEMES[S.theme] || THEMES.dark;
    engine.ttsEnabled = !!S.ttsEnabled;
    engine.speedMul = Number(S.speed) || 1;
    engine.voice = { name: S.voiceName, rate: Number(S.voiceRate) || 1, volume: Number(S.voiceVolume) };
    engine.defaultBg = t.bg;
    if (!engine.playing) { engine.bg = t.bg; engine.render(); }
  }

  // ---------- detection ----------
  function hasDraw(text) {
    if (!text) return false;
    return /\\\(\s*(?:point|dot|line|arrow|doublearrow|circle|ellipse|arc|rect|rectangle|roundrect|triangle|polygon|polyline|quadratic|bezier|cubic|cylinder|cone|text|label|highlight|cross|bracket|grid|axes|axes2d|plot|function|pie|bars|angle|dimension|numberline|sphere|cube|box|pyramid|helix|spiral|star|ngon|regular|pentagon|hexagon|heptagon|octagon|camera|background|image|clear|wait)\b/i.test(repair(text));
  }

  function extractText(root) {
    if (!root) return "";
    if (root.tagName === "PRE" || root.tagName === "CODE") {
      const lines = root.querySelectorAll(".cm-line");
      let t = lines.length ? Array.from(lines).map((l) => l.textContent).join("\n") : (root.textContent || "");
      // Code-block chrome ("drawscript", "Copy code") is not part of the script.
      t = t.replace(/^\s*(?:drawscript|text|plaintext)\s*\n/i, "").replace(/^\s*(?:copy code|copy|edit)\s*\n/i, "");
      return t.replace(/\\\\\(/g, "\\(").replace(/\\\\\)/g, "\\)").trim();
    }
    let out = "";
    (function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) { out += node.nodeValue || ""; return; }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const cl = node.classList;
      if (cl && (cl.contains("ds3d-code-bar") || cl.contains("ds3d-msg-bar"))) return;
      if (cl && cl.contains("katex-error")) { out += (node.getAttribute("title") || node.textContent || "").replace(/^.*?:\s*/, ""); return; }
      if (cl && (cl.contains("katex") || cl.contains("katex-display"))) {
        const ann = node.querySelector('annotation[encoding="application/x-tex"]');
        if (ann && ann.textContent) { out += "\\(" + ann.textContent.trim() + "\\)"; return; }
      }
      if (node.tagName === "BR") { out += "\n"; return; }
      for (const c of node.childNodes) walk(c);
      if (/^(P|DIV|LI|PRE|H1|H2|H3|H4|BLOCKQUOTE)$/i.test(node.tagName)) out += "\n";
    })(root);
    return out.replace(/\\\\\(/g, "\\(").replace(/\\\\\)/g, "\\)").replace(/\n{3,}/g, "\n\n").trim();
  }

  function assistantMessages() {
    const list = document.querySelectorAll('[data-message-author-role="assistant"], [data-testid="assistant-message"], .font-claude-message, .font-claude-response');
    return Array.from(list).filter((el) => !el.parentElement || !el.parentElement.closest('[data-message-author-role="assistant"], .font-claude-message, .font-claude-response'));
  }

  function scriptFromMessage(msg) {
    const pres = Array.from(msg.querySelectorAll("pre"));
    for (let i = pres.length - 1; i >= 0; i--) {
      const t = extractText(pres[i].querySelector("code") || pres[i]);
      if (hasDraw(t)) return repair(t);
    }
    const t = extractText(msg);
    return hasDraw(t) ? repair(t) : null;
  }

  function findLatestScript() {
    const msgs = assistantMessages();
    for (let i = msgs.length - 1; i >= 0; i--) {
      const s = scriptFromMessage(msgs[i]);
      if (s) return s;
    }
    const pres = Array.from(document.querySelectorAll("pre"));
    for (let i = pres.length - 1; i >= 0; i--) {
      const t = extractText(pres[i].querySelector("code") || pres[i]);
      if (hasDraw(t) && !pres[i].closest(".ds3d-overlay,.ds3d-dock")) return repair(t);
    }
    return null;
  }

  let lastLen = -1, lastChange = 0;
  function recentlyChanged() {
    const msgs = assistantMessages();
    const m = msgs[msgs.length - 1];
    const len = m ? (m.textContent || "").length : 0;
    const now = Date.now();
    if (len !== lastLen) { lastLen = len; lastChange = now; }
    return now - lastChange < 2500;
  }
  function isStreaming() {
    const flagged = !!(
      document.querySelector('button[data-testid="stop-button"]') ||
      document.querySelector('button[aria-label*="Stop"]') ||
      document.querySelector(".result-streaming") ||
      document.querySelector('[data-is-streaming="true"]')
    );
    // Indicators can get stuck (mobile layouts); a reply whose text stopped changing is finished.
    return flagged && recentlyChanged();
  }

  // ---------- composer ----------
  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 12) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }
  function findComposer() {
    const sels = ["#prompt-textarea", 'div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"][role="textbox"]', 'div[contenteditable="true"]', "textarea"];
    for (const sel of sels) {
      for (const el of document.querySelectorAll(sel)) {
        if (el.closest(".ds3d-overlay,.ds3d-dock")) continue;
        if (isVisible(el)) return el;
      }
    }
    return null;
  }
  function composerText(el) {
    return el ? (el.tagName === "TEXTAREA" ? el.value : (el.innerText || el.textContent || "")) : "";
  }
  function copyText(text) {
    const legacy = () => {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta); ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(legacy);
    } catch (e) { /* fall through */ }
    return legacy();
  }
  function setComposerText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA") {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const sel = getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges(); sel.addRange(range);
    let handled = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      handled = !el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    } catch (e) { handled = false; }
    if (!handled) document.execCommand("insertText", false, text);
  }
  function clickSend() {
    const btn = document.querySelector('button[data-testid="send-button"]') ||
      document.querySelector('button[aria-label*="Send"]') ||
      document.querySelector('form button[type="submit"]');
    if (btn && !btn.disabled) { btn.click(); return true; }
    return false;
  }

  function wrapAndMaybeSend(send) {
    const composer = findComposer();
    if (!composer) { status("Click inside the chat box first", "warn"); return; }
    const current = composerText(composer).trim();
    const marker = window.DrawScriptPrompt.MARKER;
    const already = current.indexOf(marker) !== -1;
    const full = already ? current : window.DrawScriptPrompt.build(current, S);
    if (!already) { try { setComposerText(composer, full); } catch (e) { /* verified below */ } }

    status(already ? "Prompt already inserted" : "Inserting prompt…", "busy");
    setTimeout(() => {
      const fresh = findComposer() || composer;
      if (composerText(fresh).indexOf("DrawScript 3D") === -1) {
        copyText(full).then(
          () => status("Couldn't type it — prompt copied. Paste it (Ctrl/Cmd+V) and send.", "warn"),
          () => status("Couldn't insert the prompt", "error")
        );
        return;
      }
      waiting = true;
      if (send && S.autoSend) {
        setTimeout(() => {
          if (clickSend()) status("Sent — waiting for the DrawScript reply…", "busy");
          else status("Prompt ready — press Send", "ok");
        }, 200);
      } else status("Prompt ready — press Send, I'll draw the reply", "ok");
    }, 250);
  }

  // ---------- UI helpers ----------
  const ICON = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/></svg>',
    cube: '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.2 6.4 3.5L12 11.2 5.6 7.7 12 4.2zM5 9.4l6 3.3v6.6l-6-3.3V9.4zm8 9.9v-6.6l6-3.3v6.6l-6 3.3z"/></svg>',
    img: '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v10l4-4 3 3 4-5 5 6V5H5z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>',
    voice: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v8H3V5h2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M8 3h11a2 2 0 0 1 2 2v12h-2V5H8V3zM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/></svg>',
    gear: '<svg viewBox="0 0 24 24"><path d="M19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4L10.7 6a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1c.5.4 1.1.7 1.7 1l.3 2.7h4l.3-2.7c.6-.3 1.2-.6 1.7-1l2.4 1 2-3.4-2-1.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/></svg>',
    min: '<svg viewBox="0 0 24 24"><path d="M5 11h14v2H5z"/></svg>',
    send: '<svg viewBox="0 0 24 24"><path d="M3 20.5v-6l12-2.5-12-2.5v-6L22 12 3 20.5z"/></svg>'
  };
  function btn(action, icon, label, cls) {
    return '<button type="button" class="ds3d-btn' + (cls ? " " + cls : "") + '" data-action="' + action + '" title="' + label + '" aria-label="' + label + '">' + (icon || "") + '<span>' + label + "</span></button>";
  }

  function toast(msg) {
    if (!overlay) return;
    const t = overlay.querySelector(".ds3d-toast");
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
  }

  // ---------- dock ----------
  let statusEl = null, statusDot = null;
  function status(msg, kind) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    if (statusDot) statusDot.className = "ds3d-dot " + (kind || "");
    if (dock) dock.classList.toggle("has-status", true);
  }

  function ensureDock() {
    if (dock && document.body.contains(dock)) return;
    dock = document.createElement("div");
    dock.className = "ds3d-dock";
    dock.innerHTML =
      '<div class="ds3d-dock-card">' +
        '<div class="ds3d-dock-head">' +
          '<span class="ds3d-logo">' + ICON.cube + '</span>' +
          '<span class="ds3d-brand">DrawScript 3D</span>' +
          '<button type="button" class="ds3d-icon" data-dock="side" title="Move dock to other side" aria-label="Move dock">⇄</button>' +
          '<button type="button" class="ds3d-icon" data-dock="collapse" title="Minimise" aria-label="Minimise">' + ICON.min + '</button>' +
        '</div>' +
        '<div class="ds3d-dock-actions">' +
          '<button type="button" class="ds3d-pri" data-dock="ask" title="Adds the DrawScript instructions to your question, sends it, and draws the answer">' + ICON.send + '<span>Ask &amp; Draw</span></button>' +
          '<button type="button" class="ds3d-sec" data-dock="insert" title="Only insert the instructions; you press Send">Insert prompt</button>' +
          '<button type="button" class="ds3d-sec" data-dock="draw" title="Draw the latest DrawScript reply on this page">' + ICON.play + '<span>Draw latest</span></button>' +
        '</div>' +
        '<div class="ds3d-toggles">' +
          '<label class="ds3d-chip"><input type="checkbox" data-opt="autoDraw"><span>Auto-draw</span></label>' +
          '<label class="ds3d-chip"><input type="checkbox" data-opt="ttsEnabled"><span>Voice</span></label>' +
          '<button type="button" class="ds3d-chip" data-dock="settings">' + ICON.gear + '<span>More</span></button>' +
        '</div>' +
        '<div class="ds3d-status"><i class="ds3d-dot"></i><span>Ready</span></div>' +
      '</div>' +
      '<button type="button" class="ds3d-fab" data-dock="expand" title="Open DrawScript 3D" aria-label="Open DrawScript 3D">' + ICON.cube + '</button>';
    document.body.appendChild(dock);
    statusEl = dock.querySelector(".ds3d-status span");
    statusDot = dock.querySelector(".ds3d-dot");

    dock.addEventListener("click", (e) => {
      const b = e.target.closest("[data-dock]");
      if (!b) return;
      const a = b.dataset.dock;
      if (a === "ask") wrapAndMaybeSend(true);
      else if (a === "insert") wrapAndMaybeSend(false);
      else if (a === "draw") {
        const s = findLatestScript();
        if (s) openAndDraw(s);
        else {
          // Last resort: hand the newest code block / reply to the engine anyway.
          const ms = assistantMessages(), m = ms[ms.length - 1];
          const pres = m ? m.querySelectorAll("pre") : document.querySelectorAll("pre");
          const raw = pres.length ? extractText(pres[pres.length - 1]) : (m ? extractText(m) : "");
          if (raw && raw.length > 20) { status("Trying the latest reply…", "warn"); openAndDraw(repair(raw)); }
          else status("No DrawScript reply found on this page yet", "warn");
        }
      }
      else if (a === "collapse") save({ dockCollapsed: true });
      else if (a === "expand") save({ dockCollapsed: false });
      else if (a === "side") save({ dockSide: S.dockSide === "right" ? "left" : "right" });
      else if (a === "settings") send({ type: "OPEN_OPTIONS" });
    });
    dock.addEventListener("change", (e) => {
      const o = e.target.dataset && e.target.dataset.opt;
      if (o) save({ [o]: e.target.checked });
    });
    applyDockSettings();
  }

  function applyDockSettings() {
    dock.classList.toggle("collapsed", !!S.dockCollapsed);
    dock.classList.toggle("left", S.dockSide === "left");
    dock.querySelectorAll("input[data-opt]").forEach((i) => { i.checked = !!S[i.dataset.opt]; });
  }

  function save(obj) {
    Object.assign(S, obj);
    try { chrome.storage.local.set(obj); } catch (e) { /* ignore */ }
    applySettings();
  }
  function send(msg) {
    try { chrome.runtime.sendMessage(msg); } catch (e) { /* extension reloaded */ }
  }

  // ---------- overlay ----------
  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return;
    overlay = document.createElement("div");
    overlay.className = "ds3d-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-label", "DrawScript 3D canvas");
    overlay.innerHTML =
      '<div class="ds3d-head">' +
        '<span class="ds3d-logo">' + ICON.cube + '</span>' +
        '<div class="ds3d-title">DrawScript 3D<small class="ds3d-sub">Drag to orbit · scroll or pinch to zoom</small></div>' +
        '<div class="ds3d-head-actions">' +
          btn("full", ICON.full, "Fullscreen", "ds3d-ico") +
          btn("close", ICON.close, "Close", "ds3d-ico") +
        '</div>' +
      '</div>' +
      '<div class="ds3d-stage"><canvas class="ds3d-canvas"></canvas><div class="ds3d-toast"></div><div class="ds3d-bar"><i></i></div></div>' +
      '<div class="ds3d-caption"></div>' +
      '<div class="ds3d-tools">' +
        btn("replay", ICON.replay, "Replay", "ds3d-pri") +
        btn("stop", ICON.stop, "Stop") +
        btn("reset", "", "Reset view") +
        btn("voice", ICON.voice, "Voice") +
        '<label class="ds3d-sel"><span>Speed</span><select data-opt="speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option></select></label>' +
        '<label class="ds3d-sel"><span>Theme</span><select data-opt="theme"><option value="dark">Dark</option><option value="chalkboard">Chalkboard</option><option value="blueprint">Blueprint</option><option value="paper">Paper</option></select></label>' +
        btn("png", ICON.img, "Save PNG") +
        btn("studio", ICON.ext, "Studio") +
        btn("copy", ICON.copy, "Copy script") +
      '</div>';
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector(".ds3d-canvas");
    const caption = overlay.querySelector(".ds3d-caption");
    engine = new window.DrawScriptOverlayEngine(canvas, (msg) => { caption.textContent = msg; });
    progressTick();
    applyEngineSettings();

    // pointer orbit + pinch zoom
    const pts = new Map();
    let pinch = 0;
    canvas.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); canvas.setPointerCapture(e.pointerId); pinch = 0; });
    canvas.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId);
      pts.set(e.pointerId, e);
      if (pts.size === 1) engine.orbit(e.clientX - prev.clientX, e.clientY - prev.clientY);
      else if (pts.size === 2) {
        const [a, b] = Array.from(pts.values());
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (pinch) engine.zoomBy(d / pinch);
        pinch = d;
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("dblclick", () => engine.resetCamera());
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); engine.zoomBy(Math.exp(-e.deltaY * 0.001)); }, { passive: false });

    overlay.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-action]");
      if (!b) return;
      const a = b.dataset.action;
      if (a === "replay") { engine.resize(); engine.play(currentScript); }
      else if (a === "stop") { engine.stop(); toast("Stopped"); }
      else if (a === "reset") engine.resetCamera();
      else if (a === "voice") { save({ ttsEnabled: !S.ttsEnabled }); if (!S.ttsEnabled) window.speechSynthesis && speechSynthesis.cancel(); toast(S.ttsEnabled ? "Voice on" : "Voice off"); }
      else if (a === "png") savePng();
      else if (a === "studio") send({ type: "OPEN_DRAWSCRIPT_APP", script: currentScript, source: location.hostname });
      else if (a === "copy") copyText(currentScript).then(() => toast("Script copied"), () => toast("Copy blocked"));
      else if (a === "full") { save({ overlayMode: S.overlayMode === "fullscreen" ? "floating" : "fullscreen" }); setTimeout(() => engine.resize(), 60); }
      else if (a === "close") closeOverlay();
    });
    overlay.addEventListener("change", (e) => {
      const o = e.target.dataset && e.target.dataset.opt;
      if (o) save({ [o]: o === "speed" ? Number(e.target.value) : e.target.value });
    });
    window.addEventListener("resize", () => { if (overlay && overlay.classList.contains("open")) engine.resize(); });
    applyOverlaySettings();
  }

  function applyOverlaySettings() {
    overlay.classList.toggle("fullscreen", S.overlayMode === "fullscreen");
    overlay.classList.toggle("no-caption", !S.captions);
    const t = THEMES[S.theme] || THEMES.dark;
    overlay.querySelector(".ds3d-canvas").style.filter = t.filter;
    overlay.dataset.theme = S.theme;
    overlay.querySelectorAll("select[data-opt]").forEach((s) => { s.value = String(S[s.dataset.opt]); });
    const v = overlay.querySelector('[data-action="voice"]');
    v.innerHTML = (S.ttsEnabled ? ICON.voice : ICON.mute) + "<span>" + (S.ttsEnabled ? "Voice on" : "Voice off") + "</span>";
    v.classList.toggle("off", !S.ttsEnabled);
    const full = overlay.querySelector('[data-action="full"] span');
    if (full) full.textContent = S.overlayMode === "fullscreen" ? "Windowed" : "Fullscreen";
  }

  function progressTick() {
    const bar = overlay.querySelector(".ds3d-bar i");
    const loop = () => {
      if (!overlay || !document.body.contains(overlay)) return;
      const total = engine.total || 0;
      bar.style.width = total ? Math.min(100, (engine.done / total) * 100) + "%" : "0%";
      requestAnimationFrame(loop);
    };
    loop();
  }

  function savePng() {
    if (!engine) return;
    try {
      const src = engine.canvas;
      const c = document.createElement("canvas");
      c.width = src.width; c.height = src.height;
      const ctx = c.getContext("2d");
      const t = THEMES[S.theme] || THEMES.dark;
      if (t.filter) ctx.filter = t.filter;
      engine.render();
      ctx.drawImage(src, 0, 0);
      const a = document.createElement("a");
      a.download = "drawscript-" + Date.now() + ".png";
      a.href = c.toDataURL("image/png");
      document.body.appendChild(a); a.click(); a.remove();
      toast("Saved PNG");
    } catch (e) { toast("Could not save PNG"); }
  }

  function closeOverlay() {
    if (engine) engine.stop();
    if (overlay) overlay.classList.remove("open");
    document.documentElement.classList.remove("ds3d-lock");
  }

  function openAndDraw(script) {
    if (!script) return;
    currentScript = script;
    ensureOverlay();
    overlay.classList.add("open");
    applySettings();
    requestAnimationFrame(() => {
      engine.resize();
      applyEngineSettings();
      engine.play(script);
    });
    status("Drawing lesson…", "ok");
  }

  // ---------- message action bars ----------
  function decorate() {
    // Bars on <pre> blocks holding DrawScript.
    document.querySelectorAll("pre").forEach((pre) => {
      if (pre.closest(".ds3d-overlay,.ds3d-dock")) return;
      const code = pre.querySelector("code") || pre;
      const text = extractText(code);
      const ok = hasDraw(text);
      const bar = pre.previousElementSibling && pre.previousElementSibling.classList.contains("ds3d-code-bar") ? pre.previousElementSibling : null;
      if (!ok) { if (bar && pre.dataset.ds3dBar) { bar.remove(); delete pre.dataset.ds3dBar; } return; }
      if (bar) return;
      const el = document.createElement("div");
      el.className = "ds3d-code-bar";
      el.innerHTML = '<span class="ds3d-code-label"><i class="ds3d-dot ok"></i>DrawScript detected</span><span class="ds3d-code-actions">' +
        '<button type="button" class="ds3d-mini pri" data-bar="draw">' + ICON.play + 'Draw</button>' +
        '<button type="button" class="ds3d-mini" data-bar="studio">Studio</button></span>';
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bar]");
        if (!b) return;
        const t = repair(extractText(pre.querySelector("code") || pre));
        if (b.dataset.bar === "draw") openAndDraw(t);
        else send({ type: "OPEN_DRAWSCRIPT_APP", script: t, source: location.hostname });
      });
      pre.dataset.ds3dBar = "1";
      pre.parentElement && pre.parentElement.insertBefore(el, pre);
    });

    // Plain (non-code) replies: one bar at the end of the message.
    assistantMessages().forEach((msg) => {
      if (msg.querySelector("pre") && Array.from(msg.querySelectorAll("pre")).some((p) => hasDraw(extractText(p)))) return;
      const has = msg.querySelector(".ds3d-msg-bar");
      const ok = hasDraw(extractText(msg));
      if (!ok) { if (has) has.remove(); return; }
      if (has) return;
      const el = document.createElement("div");
      el.className = "ds3d-code-bar ds3d-msg-bar";
      el.innerHTML = '<span class="ds3d-code-label"><i class="ds3d-dot ok"></i>DrawScript detected</span><span class="ds3d-code-actions">' +
        '<button type="button" class="ds3d-mini pri" data-bar="draw">' + ICON.play + 'Draw</button>' +
        '<button type="button" class="ds3d-mini" data-bar="studio">Studio</button></span>';
      el.addEventListener("click", (e) => {
        const b = e.target.closest("[data-bar]");
        if (!b) return;
        const t = repair(extractText(msg));
        if (b.dataset.bar === "draw") openAndDraw(t);
        else send({ type: "OPEN_DRAWSCRIPT_APP", script: t, source: location.hostname });
      });
      msg.appendChild(el);
    });
  }

  // ---------- auto draw ----------
  function check() {
    ensureDock();
    if (isStreaming()) {
      if (waiting) status("Assistant is writing the lesson…", "busy");
      return;
    }
    decorate();
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      if (isStreaming()) return;
      const latest = findLatestScript();
      if (!primed) { primed = true; lastDrawnSig = latest || ""; return; }
      if (!latest && waiting) status("Reply finished, but no DrawScript found. Try “Draw latest”.", "warn");
      if (!latest || latest === lastDrawnSig) return;
      if (waiting || S.autoDraw) {
        lastDrawnSig = latest;
        waiting = false;
        openAndDraw(latest);
      }
    }, 700);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay && overlay.classList.contains("open")) { closeOverlay(); return; }
    if (e.key === "Enter" && !e.shiftKey && !e.isComposing) {
      const c = findComposer();
      if (c && composerText(c).indexOf("DrawScript 3D") !== -1) { waiting = true; status("Sent — waiting for the DrawScript reply…", "busy"); }
    }
  }, true);

  // The site's own send button (mouse/touch) should also arm auto-draw.
  document.addEventListener("click", (e) => {
    const b = e.target.closest && e.target.closest('button[data-testid="send-button"], button[aria-label*="Send"]');
    if (b && !b.closest(".ds3d-dock")) {
      const c = findComposer();
      if (c && composerText(c).indexOf("DrawScript 3D") !== -1) { waiting = true; status("Sent — waiting for the DrawScript reply…", "busy"); }
    }
  }, true);

  try {
    chrome.runtime.onMessage.addListener((m) => { if (m && m.type === "DRAW_NOW") { const s = findLatestScript(); if (s) openAndDraw(s); } });
  } catch (e) { /* ignore */ }

  loadSettings(() => {
    ensureDock();
    check();
    new MutationObserver((muts) => { if (muts.every((m) => { const n = m.target.nodeType === 1 ? m.target : m.target.parentElement; return n && n.closest(".ds3d-overlay,.ds3d-dock,.ds3d-code-bar"); })) return; check(); }).observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(check, 1200);
  });
})();
