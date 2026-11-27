// DrawScript 3D lesson player: canvas + step controls + tools. Used by the in-page overlay and the Lab page.
(function (global) {
  "use strict";
  const THEMES = {
    dark: { bg: "#030712", filter: "" },
    chalkboard: { bg: "#17352b", filter: "" },
    blueprint: { bg: "#0a3566", filter: "" },
    paper: { bg: "#030712", filter: "invert(1) hue-rotate(180deg)" }
  };
  const I = {
    prev: '<svg viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6L18 6v12z"/></svg>',
    next: '<svg viewBox="0 0 24 24"><path d="M16 6h2v12h-2zM6 18V6l8.5 6z"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    pause: '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>',
    replay: '<svg viewBox="0 0 24 24"><path d="M12 5V2L7 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z"/></svg>',
    cube: '<svg viewBox="0 0 24 24"><path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 2.2 6.4 3.5L12 11.2 5.6 7.7 12 4.2zM5 9.4l6 3.3v6.6l-6-3.3V9.4zm8 9.9v-6.6l6-3.3v6.6l-6 3.3z"/></svg>',
    img: '<svg viewBox="0 0 24 24"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm0 2v10l4-4 3 3 4-5 5 6V5H5z"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M4 4h6v2H6v4H4V4zm10 0h6v6h-2V6h-4V4zM4 14h2v4h4v2H4v-6zm14 0h2v6h-6v-2h4v-4z"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/></svg>',
    voice: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>',
    mute: '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4zm13.6 3 2.4-2.4-1.4-1.4-2.4 2.4-2.4-2.4-1.4 1.4 2.4 2.4-2.4 2.4 1.4 1.4 2.4-2.4 2.4 2.4 1.4-1.4z"/></svg>',
    ext: '<svg viewBox="0 0 24 24"><path d="M14 3h7v7h-2V6.4l-8.3 8.3-1.4-1.4L17.6 5H14V3zM5 5h6v2H5v12h12v-6h2v8H3V5h2z"/></svg>',
    copy: '<svg viewBox="0 0 24 24"><path d="M8 3h11a2 2 0 0 1 2 2v12h-2V5H8V3zM5 7h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/></svg>',
    rec: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M18 16a3 3 0 0 0-2.4 1.2l-6.3-3.1a3 3 0 0 0 0-2.2l6.3-3.1A3 3 0 1 0 15 7l-6.3 3.1a3 3 0 1 0 0 3.8L15 17a3 3 0 1 0 3-1z"/></svg>',
    more: '<svg viewBox="0 0 24 24"><path d="M5 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm7 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"/></svg>',
    cam: '<svg viewBox="0 0 24 24"><path d="M12 5C7 5 3 8 1 12c2 4 6 7 11 7s9-3 11-7c-2-4-6-7-11-7zm0 11a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/></svg>'
  };
  const b = (action, icon, label, cls) =>
    '<button type="button" class="ds3d-btn' + (cls ? " " + cls : "") + '" data-action="' + action + '" title="' + label + '" aria-label="' + label + '">' + (icon || "") + "<span>" + label + "</span></button>";

  /**
   * host = { root?, get(): settings, save(obj), studio(script), library?: bool, embedded?: bool, onClose?() }
   */
  function create(host) {
    const root = host.root || document.body;
    const el = document.createElement("div");
    el.className = "ds3d-overlay" + (host.embedded ? " embedded open" : "");
    el.setAttribute("role", "dialog");
    el.setAttribute("aria-label", "DrawScript 3D lesson player");
    el.innerHTML =
      '<div class="ds3d-head">' +
        '<span class="ds3d-logo">' + I.cube + "</span>" +
        '<div class="ds3d-title"><span class="ds3d-t">DrawScript 3D</span><small class="ds3d-sub">Drag to orbit · pinch or scroll to zoom · double-tap resets</small></div>' +
        '<div class="ds3d-head-actions">' + b("full", I.full, "Fullscreen", "ds3d-ico") + (host.embedded ? "" : b("close", I.close, "Close", "ds3d-ico")) + "</div>" +
      "</div>" +
      '<div class="ds3d-stage"><canvas class="ds3d-canvas"></canvas>' +
        '<button type="button" class="ds3d-x" data-action="full" title="Exit fullscreen" aria-label="Exit fullscreen">' + I.close + "</button>" +
        '<div class="ds3d-rec"><i></i>REC</div><div class="ds3d-toast"></div><div class="ds3d-bar"><i></i></div></div>' +
      '<div class="ds3d-caption"></div>' +
      '<div class="ds3d-transport">' +
        '<button type="button" class="ds3d-tbtn" data-action="prev" title="Previous step" aria-label="Previous step">' + I.prev + "</button>" +
        '<button type="button" class="ds3d-tbtn big" data-action="toggle" title="Play / pause" aria-label="Play or pause">' + I.pause + "</button>" +
        '<button type="button" class="ds3d-tbtn" data-action="next" title="Next step" aria-label="Next step">' + I.next + "</button>" +
        '<div class="ds3d-scrub"><input type="range" min="0" max="0" value="0" step="1" aria-label="Step"><small class="ds3d-stepl">Step 1 / 1</small></div>' +
        b("more", I.more, "More", "ds3d-ico ds3d-more") +
      "</div>" +
      '<div class="ds3d-tools">' +
        b("replay", I.replay, "Replay") + b("reset", I.cam, "Reset view") + b("voice", I.voice, "Voice") +
        '<label class="ds3d-sel"><span>Speed</span><select data-opt="speed"><option value="0.5">0.5×</option><option value="1">1×</option><option value="1.5">1.5×</option><option value="2">2×</option><option value="3">3×</option></select></label>' +
        '<label class="ds3d-sel"><span>Theme</span><select data-opt="theme"><option value="dark">Dark</option><option value="chalkboard">Chalkboard</option><option value="blueprint">Blueprint</option><option value="paper">Paper</option></select></label>' +
        '<label class="ds3d-sel"><span>Auto-clear</span><select data-opt="autoClear"><option value="0">Off</option><option value="6">6</option><option value="8">8</option><option value="12">12</option></select></label>' +
        b("png", I.img, "Save PNG") + b("video", I.rec, "Record video") + b("share", I.share, "Share link") +
        b("copy", I.copy, "Copy script") + (host.studio ? b("studio", I.ext, "Studio") : "") +
      "</div>";
    root.appendChild(el);

    const canvas = el.querySelector(".ds3d-canvas");
    const caption = el.querySelector(".ds3d-caption");
    const scrub = el.querySelector(".ds3d-scrub input");
    const stepLabel = el.querySelector(".ds3d-stepl");
    const toggleBtn = el.querySelector('[data-action="toggle"]');
    const engine = new global.DrawScriptOverlayEngine(canvas, (m) => { caption.textContent = m; });
    let script = "", recorder = null, toastTimer = null, userScrubbing = false;
    const S = () => host.get();

    function toast(m) {
      const t = el.querySelector(".ds3d-toast");
      t.textContent = m; t.classList.add("show");
      clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 1900);
    }
    function copy(text) {
      const legacy = () => {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select();
        let ok = false; try { ok = document.execCommand("copy"); } catch (e) { /* */ }
        ta.remove(); return ok ? Promise.resolve() : Promise.reject(new Error("copy"));
      };
      try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text).catch(legacy); } catch (e) { /* */ }
      return legacy();
    }

    function setPlayIcon() {
      const showPause = engine.playing && !engine.paused;
      toggleBtn.innerHTML = showPause ? I.pause : I.play;
      toggleBtn.title = showPause ? "Pause" : engine.playing ? "Resume" : "Play again";
    }

    engine.onStep = (k, n) => {
      scrub.max = String(Math.max(0, n - 1));
      if (!userScrubbing) scrub.value = String(k);
      stepLabel.textContent = "Step " + (k + 1) + " / " + n;
      const st = engine.steps[k];
      el.querySelector(".ds3d-t").textContent = st && st.title ? st.title : "DrawScript 3D";
      setPlayIcon();
    };
    engine.onEnd = () => { setPlayIcon(); if (recorder) finishRecording(); };

    function applyEngine() {
      const s = S(), t = THEMES[s.theme] || THEMES.dark;
      engine.ttsEnabled = !!s.ttsEnabled;
      engine.speedMul = Number(s.speed) || 1;
      engine.autoClear = Number(s.autoClear) || 0;
      engine.voice = { name: s.voiceName, rate: Number(s.voiceRate) || 1, volume: Number(s.voiceVolume) };
      engine.defaultBg = t.bg;
      if (!engine.playing) { engine.bg = t.bg; engine.render(); }
    }
    function apply() {
      const s = S(), t = THEMES[s.theme] || THEMES.dark;
      if (!host.embedded) el.classList.toggle("fullscreen", s.overlayMode === "fullscreen");
      el.classList.toggle("no-caption", !s.captions);
      canvas.style.filter = t.filter;
      el.dataset.theme = s.theme;
      el.querySelectorAll("select[data-opt]").forEach((x) => { x.value = String(s[x.dataset.opt]); });
      const v = el.querySelector('[data-action="voice"]');
      v.innerHTML = (s.ttsEnabled ? I.voice : I.mute) + "<span>" + (s.ttsEnabled ? "Voice on" : "Voice off") + "</span>";
      v.classList.toggle("off", !s.ttsEnabled);
      const f = el.querySelector(".ds3d-head [data-action=full] span");
      if (f) f.textContent = s.overlayMode === "fullscreen" ? "Windowed" : "Fullscreen";
      applyEngine();
    }

    function progressLoop() {
      const bar = el.querySelector(".ds3d-bar i");
      (function loop() {
        if (!document.body.contains(el)) return;
        bar.style.width = engine.total ? Math.min(100, (engine.done / engine.total) * 100) + "%" : "0%";
        requestAnimationFrame(loop);
      })();
    }
    progressLoop();

    function filtered(srcCanvas) {
      const c = document.createElement("canvas");
      c.width = srcCanvas.width; c.height = srcCanvas.height;
      const ctx = c.getContext("2d"), t = THEMES[S().theme] || THEMES.dark;
      if (t.filter) ctx.filter = t.filter;
      ctx.drawImage(srcCanvas, 0, 0);
      return c;
    }
    function download(href, name) {
      const a = document.createElement("a");
      a.download = name; a.href = href; document.body.appendChild(a); a.click(); a.remove();
    }
    function savePng() {
      try { engine.render(); download(filtered(canvas).toDataURL("image/png"), "drawscript-" + Date.now() + ".png"); toast("Saved PNG"); }
      catch (e) { toast("Could not save PNG"); }
    }

    // ---- video recording (canvas only; no audio) ----
    let recRaf = 0, recChunks = [], recMime = "";
    function startRecording() {
      if (!global.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) { toast("Video recording isn't supported here"); return; }
      const rc = document.createElement("canvas");
      rc.width = canvas.width; rc.height = canvas.height;
      const rctx = rc.getContext("2d"), t = THEMES[S().theme] || THEMES.dark;
      const paint = () => { rctx.filter = t.filter || "none"; rctx.drawImage(canvas, 0, 0, rc.width, rc.height); recRaf = requestAnimationFrame(paint); };
      recMime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m)) || "";
      try { recorder = new MediaRecorder(rc.captureStream(30), recMime ? { mimeType: recMime, videoBitsPerSecond: 4000000 } : undefined); }
      catch (e) { recorder = null; toast("Video recording failed"); return; }
      recChunks = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
      recorder.onstop = () => {
        cancelAnimationFrame(recRaf);
        const type = recMime.split(";")[0] || "video/webm";
        const blob = new Blob(recChunks, { type });
        download(URL.createObjectURL(blob), "drawscript-" + Date.now() + (type.indexOf("mp4") >= 0 ? ".mp4" : ".webm"));
        recorder = null; el.classList.remove("recording"); setRecBtn(false); toast("Video saved");
      };
      paint(); recorder.start(250);
      el.classList.add("recording"); setRecBtn(true);
      engine.resume(); engine.playFrom(0);
      toast("Recording the whole lesson…");
    }
    function finishRecording() { setTimeout(() => { if (recorder && recorder.state !== "inactive") recorder.stop(); }, 700); }
    function setRecBtn(on) {
      const r = el.querySelector('[data-action="video"]');
      r.innerHTML = I.rec + "<span>" + (on ? "Stop recording" : "Record video") + "</span>";
      r.classList.toggle("rec", on);
    }

    function shareLink() {
      const base = host.studioUrl ? host.studioUrl() : "";
      if (!base) { copy(script).then(() => toast("Script copied"), () => toast("Copy blocked")); return; }
      const url = base.replace(/\/+$/, "") + "/#drawscript=" + encodeURIComponent(script);
      if (navigator.share) { navigator.share({ title: "DrawScript lesson", url }).catch(() => {}); return; }
      copy(url).then(() => toast("Share link copied"), () => toast("Copy blocked"));
    }

    // ---- canvas gestures ----
    const pts = new Map(); let pinch = 0;
    canvas.addEventListener("pointerdown", (e) => { pts.set(e.pointerId, e); try { canvas.setPointerCapture(e.pointerId); } catch (x) { /* */ } pinch = 0; });
    canvas.addEventListener("pointermove", (e) => {
      if (!pts.has(e.pointerId)) return;
      const prev = pts.get(e.pointerId); pts.set(e.pointerId, e);
      if (pts.size === 1) engine.orbit(e.clientX - prev.clientX, e.clientY - prev.clientY);
      else if (pts.size === 2) {
        const [a, c] = Array.from(pts.values());
        const d = Math.hypot(a.clientX - c.clientX, a.clientY - c.clientY);
        if (pinch) engine.zoomBy(d / pinch);
        pinch = d;
      }
    });
    const up = (e) => { pts.delete(e.pointerId); pinch = 0; };
    canvas.addEventListener("pointerup", up); canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("dblclick", () => engine.resetCamera());
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); engine.zoomBy(Math.exp(-e.deltaY * 0.001)); }, { passive: false });

    function goStep(k) {
      const n = engine.steps.length;
      k = Math.max(0, Math.min(n - 1, k));
      engine.resume(); engine.resize(); engine.playFrom(k);
    }

    el.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-action]");
      if (!btn) return;
      const a = btn.dataset.action;
      if (a === "toggle") {
        if (engine.playing) { engine.paused ? engine.resume() : engine.pause(); setPlayIcon(); }
        else goStep(engine.currentStep >= engine.steps.length - 1 && engine.done >= engine.total ? 0 : engine.currentStep);
      }
      else if (a === "prev") goStep(engine.currentStep - 1);
      else if (a === "next") goStep(engine.currentStep + 1);
      else if (a === "replay") goStep(0);
      else if (a === "reset") engine.resetCamera();
      else if (a === "voice") { const on = !S().ttsEnabled; host.save({ ttsEnabled: on }); if (!on && global.speechSynthesis) speechSynthesis.cancel(); toast(on ? "Voice on" : "Voice off"); }
      else if (a === "png") savePng();
      else if (a === "video") { if (recorder) { recorder.stop(); } else startRecording(); }
      else if (a === "share") shareLink();
      else if (a === "studio") host.studio && host.studio(script);
      else if (a === "copy") copy(script).then(() => toast("Script copied"), () => toast("Copy blocked"));
      else if (a === "more") el.classList.toggle("tools-open");
      else if (a === "full") { host.save({ overlayMode: S().overlayMode === "fullscreen" ? "floating" : "fullscreen" }); setTimeout(() => engine.resize(), 60); }
      else if (a === "close") api.close();
    });
    el.addEventListener("change", (e) => {
      const o = e.target.dataset && e.target.dataset.opt;
      if (!o) return;
      host.save({ [o]: ["theme"].indexOf(o) >= 0 ? e.target.value : Number(e.target.value) });
    });
    scrub.addEventListener("input", () => { userScrubbing = true; stepLabel.textContent = "Step " + (Number(scrub.value) + 1) + " / " + (Number(scrub.max) + 1); });
    scrub.addEventListener("change", () => { userScrubbing = false; goStep(Number(scrub.value)); });
    window.addEventListener("resize", () => { if (api.isOpen()) engine.resize(); });
    document.addEventListener("keydown", (e) => {
      if (!api.isOpen() || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
      if (e.key === " " ) { if (host.embedded || !e.target || !e.target.isContentEditable) { e.preventDefault(); el.querySelector('[data-action="toggle"]').click(); } }
      else if (e.key === "ArrowRight") goStep(engine.currentStep + 1);
      else if (e.key === "ArrowLeft") goStep(engine.currentStep - 1);
    });

    const api = {
      el, engine,
      isOpen: () => el.classList.contains("open"),
      apply,
      open(src, opts) {
        script = src;
        el.classList.add("open");
        apply();
        requestAnimationFrame(() => {
          engine.resize(); applyEngine();
          engine.load(src);
          engine.onStep(0, engine.steps.length);
          if (opts && opts.paused) { engine.stop(); engine.playing = false; engine.render(); setPlayIcon(); }
          else engine.playFrom(0);
        });
      },
      close() {
        if (recorder && recorder.state !== "inactive") recorder.stop();
        engine.stop();
        if (!host.embedded) el.classList.remove("open");
        host.onClose && host.onClose();
      },
      script: () => script,
      toast
    };
    return api;
  }
  global.DrawScriptPlayer = { create, THEMES };
})(window);
