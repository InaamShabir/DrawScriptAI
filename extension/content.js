// DrawScript 3D Content Script for ChatGPT & Claude
(function () {
  "use strict";

  const DRAWSCRIPT_SYSTEM_PROMPT = "You are a visual educator inside DrawScript 3D.\nExplain the user's question with brief, friendly spoken narration interleaved with DrawScript drawing commands wrapped strictly in \\( ... \\).\n\nCOORDINATE SYSTEM:\n- Virtual 3D drafting canvas centered at x=400, y=300, z=0.\n- Visible 2D area: x from 100 to 700, y from 80 to 520.\n- Use z values (-150 to +150) for true 3D depth, axes, cones, and cylinders.\n\nAVAILABLE COMMANDS (wrap each inside \\( and \\)):\n- \\(grid x y cellSize rows cols color=#1e293b width=1\\)\n- \\(axes ox oy oz length color=#94a3b8 width=2\\)\n- \\(line x1 y1 x2 y2 color width=4\\) or 3D: \\(line x1 y1 z1 x2 y2 z2 color\\)\n- \\(arrow x1 y1 z1 x2 y2 z2 color width=3 head=12\\)\n- \\(circle cx cy [cz] radius color fill=rgba(...) plane=xy|xz|yz\\)\n- \\(ellipse cx cy [cz] rx ry color plane=xy|xz|yz\\)\n- \\(arc cx cy [cz] radius startRad endRad color\\)\n- \\(rect x y [z] width height color fill=rgba(...)\\)\n- \\(triangle x1 y1 x2 y2 x3 y3 color fill=rgba(...)\\)\n- \\(polygon x1 y1 x2 y2 ... color fill=rgba(...)\\)\n- \\(quadratic x0 y0 cx cy x1 y1 color width=3\\)\n- \\(bezier x0 y0 c1x c1y c2x c2y x1 y1 color\\)\n- \\(cylinder cx cy cz radius height color fill=rgba(...)\\)\n- \\(cone cx cy cz radius height color fill=rgba(...)\\)\n- \\(point x y [z] radius color\\)\n- \\(text x y \"label\" [z] color font=\"20px sans-serif\" align=center\\)\n- \\(highlight x y [z] radius color=yellow glow=16\\)\n- \\(doublearrow x1 y1 x2 y2 color width=3\\)  (arrowheads on both ends)\n- \\(pentagon|hexagon|heptagon|octagon cx cy radius color fill=rgba(...) rot=15\\)\n- \\(ngon cx cy radius sides color\\)  and  \\(star cx cy outerR innerR [points] color\\)\n- \\(sphere cx cy cz radius color lat=6 lon=6\\)  (wireframe globe)\n- \\(cube cx cy cz size color fill=rgba(...)\\)  and  \\(box cx cy cz width height depth color\\)\n- \\(pyramid cx cy cz baseSize height color fill=rgba(...)\\)\n- \\(helix cx cy cz radius height turns color\\)  and  \\(spiral cx cy radius turns color\\)\n- \\(axes2d originX originY scale xmin xmax ymin ymax color grid step=1\\)  (labelled 2D axes with ticks)\n- \\(plot \"sin(x)/x\" xmin xmax originX originY scale color width=3\\)  (graphs any f(x); supports sin cos tan sqrt abs ln log exp pi ^)\n- \\(numberline x y length min max step=1 color\\)\n- \\(pie cx cy radius v1 v2 v3 ...\\)  (auto-coloured slices with % labels)\n- \\(bars x y barWidth maxHeight v1 v2 v3 ...\\)  (auto-coloured bar chart with value labels)\n- \\(angle cx cy radius startDeg endDeg \"θ\" rays color\\)  (add \"square\" for a right-angle mark)\n- \\(dimension x1 y1 x2 y2 \"label\" offset=-24 color\\)  (measurement line with end arrows)\n- \\(camera iso | front | yaw=30 pitch=20 zoom=1.5 duration=1\\)  (animated camera move)\n- \\(background #0f172a\\)\n- \\(wait 0.6\\)\n\nRULES:\n1. Never put Markdown formatting inside \\( ... \\).\n2. Always quote multi-word text strings in text commands: \\(text 400 90 \"Pythagorean Theorem\" cyan\\).\n3. Narrate one concept at a time, then immediately draw the matching geometry.\n4. Keep coordinates well-spaced so labels never overlap.\n5. Prefer plot, axes2d, pie, bars, angle and dimension over hand-built lines when teaching graphs, statistics or geometry.";

  let overlayEl = null;
  let overlayEngine = null;
  let currentScript = "";
  let autoPlayEnabled = false;
  let ttsEnabled = true;
  const seenMessages = new WeakSet();

  chrome.storage.local.get(["autoPlay", "ttsEnabled"], (res) => {
    autoPlayEnabled = Boolean(res.autoPlay);
    ttsEnabled = res.ttsEnabled !== false;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.autoPlay) autoPlayEnabled = Boolean(changes.autoPlay.newValue);
    if (changes.ttsEnabled) {
      ttsEnabled = changes.ttsEnabled.newValue !== false;
      if (overlayEngine) overlayEngine.ttsEnabled = ttsEnabled;
    }
  });

  // KaTeX-aware DOM walker so \( ... \) math delimiters inside ChatGPT replies are preserved cleanly
  function extractCleanScriptFromElement(root) {
    let out = "";

    function walk(node) {
      if (!node) return;
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue || "";
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const el = node;
      if (el.classList && el.classList.contains("ds3d-actions")) return;

      // Recover original TeX when ChatGPT renders \(cmd\) via KaTeX
      if (el.classList && (el.classList.contains("katex") || el.classList.contains("katex-display"))) {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        if (ann && ann.textContent) {
          out += "\\(" + ann.textContent.trim() + "\\)";
          return;
        }
      }

      if (el.tagName === "BR") {
        out += "\n";
        return;
      }

      const isBlock = /^(P|DIV|LI|PRE|H1|H2|H3|H4|BLOCKQUOTE)$/i.test(el.tagName);
      for (const child of el.childNodes) {
        walk(child);
      }
      if (isBlock) out += "\n";
    }

    walk(root);
    return out
      .replace(/\\\\\(/g, "\\(")
      .replace(/\\\\\)/g, "\\)")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  function hasDrawScriptCommands(text) {
    return /\\\([a-zA-Z]+\s+[^\)]+\\\)/.test(text);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.className = "ds3d-overlay";
    overlayEl.innerHTML = `
      <div class="ds3d-header">
        <div class="ds3d-title">DrawScript 3D Canvas</div>
        <div class="ds3d-controls">
          <button type="button" class="ds3d-btn" data-action="replay">Replay</button>
          <button type="button" class="ds3d-btn" data-action="stop">Stop</button>
          <button type="button" class="ds3d-btn" data-action="reset">Reset 3D</button>
          <button type="button" class="ds3d-btn ds3d-btn-primary" data-action="sendapp">Open in Studio</button>
          <button type="button" class="ds3d-btn" data-action="close">Close</button>
        </div>
      </div>
      <div class="ds3d-stage">
        <canvas class="ds3d-canvas"></canvas>
      </div>
      <div class="ds3d-caption">Waiting for DrawScript lesson...</div>
    `;

    document.body.appendChild(overlayEl);

    const canvas = overlayEl.querySelector(".ds3d-canvas");
    const caption = overlayEl.querySelector(".ds3d-caption");
    overlayEngine = new window.DrawScriptOverlayEngine(canvas, (msg) => {
      caption.textContent = msg;
    });
    overlayEngine.ttsEnabled = ttsEnabled;

    // Orbit & zoom gestures on overlay canvas
    let dragging = false;
    let lastX = 0, lastY = 0;
    canvas.addEventListener("pointerdown", (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      overlayEngine.orbit(e.clientX - lastX, e.clientY - lastY);
      lastX = e.clientX;
      lastY = e.clientY;
    });
    canvas.addEventListener("pointerup", () => { dragging = false; });
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      overlayEngine.zoomBy(Math.exp(-e.deltaY * 0.001));
    }, { passive: false });

    overlayEl.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;
      if (action === "replay") overlayEngine.play(currentScript);
      if (action === "stop") overlayEngine.stop();
      if (action === "reset") overlayEngine.resetCamera();
      if (action === "sendapp") {
        chrome.runtime.sendMessage({ type: "OPEN_DRAWSCRIPT_APP", script: currentScript, source: location.hostname });
      }
      if (action === "close") {
        overlayEngine.stop();
        overlayEl.style.display = "none";
      }
    });

    return overlayEl;
  }

  function playInOverlay(script) {
    currentScript = script;
    const el = ensureOverlay();
    el.style.display = "flex";
    overlayEngine.resize();
    overlayEngine.play(script);
  }

  function injectMessageButtons(msgEl) {
    if (seenMessages.has(msgEl)) return;
    const raw = extractCleanScriptFromElement(msgEl);
    if (!hasDrawScriptCommands(raw)) return;

    seenMessages.add(msgEl);
    const bar = document.createElement("div");
    bar.className = "ds3d-actions";

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = "ds3d-action-btn ds3d-action-primary";
    playBtn.textContent = "Play in DrawScript 3D";
    playBtn.addEventListener("click", () => {
      const latest = extractCleanScriptFromElement(msgEl);
      playInOverlay(latest);
    });

    const appBtn = document.createElement("button");
    appBtn.type = "button";
    appBtn.className = "ds3d-action-btn";
    appBtn.textContent = "Send to DrawScript App";
    appBtn.addEventListener("click", () => {
      const latest = extractCleanScriptFromElement(msgEl);
      chrome.runtime.sendMessage({
        type: "OPEN_DRAWSCRIPT_APP",
        script: latest,
        source: location.hostname
      });
    });

    bar.appendChild(playBtn);
    bar.appendChild(appBtn);
    msgEl.appendChild(bar);

    if (autoPlayEnabled) {
      setTimeout(() => playInOverlay(extractCleanScriptFromElement(msgEl)), 600);
    }
  }

  // ---- "+ Wrap DrawScript Prompt" button -------------------------------------
  const WRAP_LABEL = "+ Wrap DrawScript Prompt";
  let wrapBtn = null;
  let wrapResetTimer = null;

  function isVisibleEl(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 12) return false;
    const st = window.getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none";
  }

  // Looked up fresh on every call: ChatGPT / Claude re-render the composer, so a
  // reference captured earlier can point at a detached element.
  function findComposer() {
    const selectors = [
      "#prompt-textarea",
      'div[contenteditable="true"].ProseMirror',
      'div[contenteditable="true"][role="textbox"]',
      'div[contenteditable="true"]',
      "textarea"
    ];
    for (const sel of selectors) {
      const list = document.querySelectorAll(sel);
      for (const el of list) {
        if (el.closest(".ds3d-overlay")) continue;
        if (isVisibleEl(el)) return el;
      }
    }
    return null;
  }

  function composerText(el) {
    return el.tagName === "TEXTAREA" ? el.value : (el.innerText || el.textContent || "");
  }

  function flashWrapButton(message) {
    if (!wrapBtn) return;
    wrapBtn.textContent = message;
    if (wrapResetTimer) clearTimeout(wrapResetTimer);
    wrapResetTimer = setTimeout(() => { if (wrapBtn) wrapBtn.textContent = WRAP_LABEL; }, 2600);
  }

  function copyToClipboard(text) {
    const legacyCopy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e) { ok = false; }
      ta.remove();
      return ok ? Promise.resolve() : Promise.reject(new Error("copy failed"));
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(legacyCopy);
      }
    } catch (e) { /* use the legacy path */ }
    return legacyCopy();
  }

  // Replace the composer contents in a way React / ProseMirror actually notice.
  function setComposerText(el, text) {
    el.focus();
    if (el.tagName === "TEXTAREA") {
      // React tracks the value through the native setter; assigning .value directly is ignored.
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(el, text);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);

    // A synthetic paste is handled natively by ProseMirror (keeps line breaks).
    let handled = false;
    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      const ev = new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true });
      handled = !el.dispatchEvent(ev);
    } catch (e) { handled = false; }
    if (!handled) document.execCommand("insertText", false, text);
  }

  function onWrapClick(event) {
    event.preventDefault();
    event.stopPropagation();
    const composer = findComposer();
    if (!composer) { flashWrapButton("Click the chat box first"); return; }

    const current = composerText(composer).trim();
    if (current.indexOf("You are a visual educator inside DrawScript 3D") !== -1) {
      flashWrapButton("Already wrapped");
      return;
    }
    const wrapped = DRAWSCRIPT_SYSTEM_PROMPT + "\n\nStudent Question: " + (current || "Explain the Pythagorean theorem visually.");

    try { setComposerText(composer, wrapped); } catch (e) { /* verified below */ }

    // Give the editor a moment to apply the change, then confirm it took.
    setTimeout(() => {
      const fresh = findComposer() || composer;
      if (composerText(fresh).indexOf("DrawScript 3D") !== -1) {
        flashWrapButton("✓ Wrapped");
        return;
      }
      copyToClipboard(wrapped).then(
        () => flashWrapButton("Copied – press Ctrl/Cmd+V"),
        () => flashWrapButton("Could not insert prompt")
      );
    }, 250);
  }

  // The button floats above the composer (position: fixed on <body>) so the sites'
  // own layout and re-renders can neither hide it nor remove it.
  function positionWrapButton() {
    if (!wrapBtn) return;
    const composer = findComposer();
    if (!composer) { wrapBtn.style.display = "none"; return; }
    const r = composer.getBoundingClientRect();
    wrapBtn.style.display = "inline-flex";
    const h = wrapBtn.offsetHeight || 28;
    const top = Math.max(8, r.top - h - 8);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - (wrapBtn.offsetWidth || 180) - 8));
    wrapBtn.style.top = top + "px";
    wrapBtn.style.left = left + "px";
  }

  function ensureComposerHelper() {
    if (!wrapBtn || !document.body.contains(wrapBtn)) {
      wrapBtn = document.createElement("button");
      wrapBtn.type = "button";
      wrapBtn.className = "ds3d-composer-btn";
      wrapBtn.textContent = WRAP_LABEL;
      wrapBtn.title = "Prepends the DrawScript 3D command grammar above your question";
      // mousedown would blur the composer and drop its selection before the click fires.
      wrapBtn.addEventListener("mousedown", (e) => e.preventDefault());
      wrapBtn.addEventListener("click", onWrapClick);
      document.body.appendChild(wrapBtn);
    }
    positionWrapButton();
  }

  window.addEventListener("resize", positionWrapButton);
  window.addEventListener("scroll", positionWrapButton, true);
  setInterval(positionWrapButton, 600);

  function scanPage() {
    ensureComposerHelper();
    const selectors = [
      '[data-message-author-role="assistant"] .markdown',
      '[data-message-author-role="assistant"]',
      '.font-claude-message',
      '[data-testid="assistant-message"]'
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => injectMessageButtons(el));
    }
  }

  const observer = new MutationObserver(() => {
    scanPage();
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(scanPage, 1000);
})();
