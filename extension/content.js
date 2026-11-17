// DrawScript 3D Content Script for ChatGPT & Claude
(function () {
  "use strict";

  const DRAWSCRIPT_SYSTEM_PROMPT = `You are a visual educator inside DrawScript 3D.
Explain the user's question with brief, friendly spoken narration interleaved with DrawScript drawing commands wrapped strictly in \\( ... \\).

COORDINATE SYSTEM:
- Virtual 3D drafting canvas centered at x=400, y=300, z=0.
- Visible 2D area: x from 100 to 700, y from 80 to 520.
- Use z values (-150 to +150) for true 3D depth, axes, cones, and cylinders.

AVAILABLE COMMANDS (wrap each inside \\( and \\)):
- \\(grid x y cellSize rows cols color=#1e293b width=1\\)
- \\(axes ox oy oz length color=#94a3b8 width=2\\)
- \\(line x1 y1 x2 y2 color width=4\\) or 3D: \\(line x1 y1 z1 x2 y2 z2 color\\)
- \\(arrow x1 y1 z1 x2 y2 z2 color width=3 head=12\\)
- \\(circle cx cy [cz] radius color fill=rgba(...) plane=xy|xz|yz\\)
- \\(ellipse cx cy [cz] rx ry color plane=xy|xz|yz\\)
- \\(arc cx cy [cz] radius startRad endRad color\\)
- \\(rect x y [z] width height color fill=rgba(...)\\)
- \\(triangle x1 y1 x2 y2 x3 y3 color fill=rgba(...)\\)
- \\(polygon x1 y1 x2 y2 ... color fill=rgba(...)\\)
- \\(quadratic x0 y0 cx cy x1 y1 color width=3\\)
- \\(bezier x0 y0 c1x c1y c2x c2y x1 y1 color\\)
- \\(cylinder cx cy cz radius height color fill=rgba(...)\\)
- \\(cone cx cy cz radius height color fill=rgba(...)\\)
- \\(point x y [z] radius color\\)
- \\(text x y "label" [z] color font="20px sans-serif" align=center\\)
- \\(highlight x y [z] radius color=yellow glow=16\\)
- \\(wait 0.6\\)

RULES:
1. Never put Markdown formatting inside \\( ... \\).
2. Always quote multi-word text strings in text commands: \\(text 400 90 "Pythagorean Theorem" cyan\\).
3. Narrate one concept at a time, then immediately draw the matching geometry.
4. Keep coordinates well-spaced so labels never overlap.`;

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
    return /\\\([a-zA-Z]+\s+[^)]+\\\)/.test(text);
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
      playInOverlay(extractCleanScriptFromElement(msgEl));
    });

    const appBtn = document.createElement("button");
    appBtn.type = "button";
    appBtn.className = "ds3d-action-btn";
    appBtn.textContent = "Send to DrawScript App";
    appBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({
        type: "OPEN_DRAWSCRIPT_APP",
        script: extractCleanScriptFromElement(msgEl),
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

  function ensureComposerHelper() {
    if (document.querySelector(".ds3d-composer-btn")) return;
    const composer =
      document.querySelector("#prompt-textarea") ||
      document.querySelector('div[contenteditable="true"].ProseMirror') ||
      document.querySelector("textarea");
    if (!composer || !composer.parentElement) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "ds3d-composer-btn";
    btn.textContent = "+ Wrap DrawScript Prompt";
    btn.title = "Prepends the DrawScript 3D command grammar above your question";

    btn.addEventListener("click", () => {
      const currentVal = composer.tagName === "TEXTAREA" ? composer.value : composer.innerText;
      if (currentVal.includes("DrawScript 3D")) return;
      const wrapped =
        DRAWSCRIPT_SYSTEM_PROMPT +
        "\n\nStudent Question: " +
        (currentVal.trim() || "Explain the Pythagorean theorem visually.");
      if (composer.tagName === "TEXTAREA") {
        composer.value = wrapped;
        composer.dispatchEvent(new Event("input", { bubbles: true }));
      } else {
        composer.focus();
        document.execCommand("selectAll", false, null);
        document.execCommand("insertText", false, wrapped);
      }
    });

    composer.parentElement.insertBefore(btn, composer);
  }

  function scanPage() {
    ensureComposerHelper();
    const selectors = [
      '[data-message-author-role="assistant"] .markdown',
      '[data-message-author-role="assistant"]',
      ".font-claude-message",
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
