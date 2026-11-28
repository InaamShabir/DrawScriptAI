// DrawScript Lab: ask an AI directly, paste a script, browse saved lessons.
(function () {
  "use strict";
  const DEFAULTS = {
    autoDraw: true, autoSend: true, ttsEnabled: true, voiceName: "", voiceRate: 1, voiceVolume: 1, speed: 1, autoClear: 8,
    theme: "dark", captions: true, overlayMode: "floating", level: "auto", length: "medium", subject: "any", language: "English",
    extra: "", appUrl: "", provider: "gemini", apiKey: "", model: ""
  };
  const SAMPLES = ["Explain the Pythagorean theorem", "How does a pendulum swing?", "Show the unit circle and sine wave", "Compare a cylinder and a cone", "Forces on an inclined plane", "What is a pie chart?"];
  const DEFAULT_STUDIO = "https://inaamshabir.github.io/drawScriptAI";
  const $ = (id) => document.getElementById(id);
  let S = Object.assign({}, DEFAULTS), player;

  function save(obj) {
    Object.assign(S, obj);
    try { chrome.storage.local.set(obj); } catch (e) { /* ignore */ }
    if (player) player.apply();
  }
  chrome.storage.onChanged.addListener((ch, area) => {
    if (area !== "local") return;
    for (const k in ch) if (k in DEFAULTS) S[k] = ch[k].newValue === undefined ? DEFAULTS[k] : ch[k].newValue;
    if (player) player.apply();
    if (ch.library) renderLibrary();
  });

  function tab(name) {
    document.querySelectorAll(".tab[data-tab]").forEach((t) => t.classList.toggle("on", t.dataset.tab === name));
    document.querySelectorAll(".pane").forEach((p) => { p.hidden = p.dataset.pane !== name; });
    if (name === "library") renderLibrary();
  }
  document.querySelectorAll(".tab[data-tab]").forEach((t) => t.addEventListener("click", () => tab(t.dataset.tab)));

  function show(script, opts) {
    player.open(script, opts);
    window.DrawScriptLibrary.add(script, { source: "lab" }, renderLibrary);
    player.el.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---- library ----
  function renderLibrary() {
    window.DrawScriptLibrary.list((items) => {
      $("libCount").textContent = String(items.length);
      const box = $("libList");
      box.innerHTML = "";
      if (!items.length) { box.innerHTML = '<div class="empty">No saved lessons yet.<br>Lessons you draw are saved here automatically.</div>'; return; }
      items.forEach((it) => {
        const row = document.createElement("div");
        row.className = "item";
        const d = new Date(it.ts).toLocaleString();
        const t = document.createElement("b"); t.textContent = it.title;
        const sm = document.createElement("small"); sm.textContent = d + (it.source ? " · " + it.source : ""); t.appendChild(sm);
        const o = document.createElement("button"); o.className = "open"; o.textContent = "Open";
        o.onclick = () => show(it.script);
        const x = document.createElement("button"); x.textContent = "✕"; x.title = "Delete"; x.setAttribute("aria-label", "Delete lesson");
        x.onclick = () => window.DrawScriptLibrary.remove(it.id, renderLibrary);
        row.append(t, o, x);
        box.appendChild(row);
      });
    });
  }
  $("libClear").onclick = () => { if (confirm("Delete all saved lessons?")) window.DrawScriptLibrary.clearAll(renderLibrary); };

  // ---- paste ----
  $("drawPaste").onclick = () => {
    const raw = $("paste").value.trim();
    if (!raw) return;
    const fenced = (raw.match(/```(?:drawscript)?\s*\n([\s\S]*?)```/i) || [])[1];
    const script = window.DrawScriptRepair(fenced || raw);
    if (!window.DrawScriptParse(script).some((p) => p.type === "draw")) { $("askMsg").textContent = ""; alert("No drawing commands found in that text."); return; }
    show(script);
  };

  // ---- AI ----
  const HELP = {
    gemini: 'Get a free key at aistudio.google.com/apikey, then paste it above.',
    openai: 'Create a key at platform.openai.com/api-keys (needs billing credit).'
  };
  function updateHelp() { $("keyHelp").textContent = HELP[S.provider] || ""; $("model").placeholder = S.provider === "openai" ? "gpt-4o-mini" : "gemini-2.0-flash"; }
  $("provider").onchange = (e) => { save({ provider: e.target.value }); updateHelp(); };
  $("apiKey").onchange = (e) => save({ apiKey: e.target.value.trim() });
  $("model").onchange = (e) => save({ model: e.target.value.trim() });

  async function callAI(prompt) {
    const key = (S.apiKey || "").trim();
    if (!key) throw new Error("Add your API key under “AI setup” first.");
    if (S.provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + key },
        body: JSON.stringify({ model: S.model || "gpt-4o-mini", messages: [{ role: "user", content: prompt }], temperature: 0.4 })
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error((j.error && j.error.message) || "OpenAI error " + r.status);
      return j.choices[0].message.content;
    }
    const model = S.model || "gemini-2.0-flash";
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.4 } })
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && j.error.message) || "Gemini error " + r.status);
    const parts = j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts;
    if (!parts) throw new Error("The AI returned no text. Try rephrasing.");
    return parts.map((p) => p.text || "").join("");
  }

  async function generate() {
    const q = $("q").value.trim();
    const msg = $("askMsg"); msg.className = "hint";
    if (!q) { msg.textContent = "Type a question first."; return; }
    $("go").disabled = true; msg.textContent = "Creating your lesson…";
    try {
      const text = await callAI(window.DrawScriptPrompt.build(q, S));
      const fenced = (text.match(/```(?:drawscript)?\s*\n([\s\S]*?)```/i) || [])[1];
      const script = window.DrawScriptRepair((fenced || text).trim());
      const n = window.DrawScriptParse(script).filter((p) => p.type === "draw").length;
      if (!n) throw new Error("The AI didn't return drawing commands. Try again.");
      msg.textContent = "Lesson ready · " + n + " drawing steps";
      show(script);
    } catch (e) {
      msg.className = "hint err"; msg.textContent = String(e.message || e);
    } finally { $("go").disabled = false; }
  }
  $("go").onclick = generate;
  $("sample").onclick = () => show(window.DrawScriptSample.script);
  $("q").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate(); });
  SAMPLES.forEach((s) => { const b = document.createElement("button"); b.textContent = s; b.onclick = () => { $("q").value = s; }; $("samples").appendChild(b); });

  chrome.storage.local.get(Object.keys(DEFAULTS), (res) => {
    S = Object.assign({}, DEFAULTS, res || {});
    $("provider").value = S.provider; $("apiKey").value = S.apiKey; $("model").value = S.model; updateHelp();
    player = window.DrawScriptPlayer.create({
      root: $("playerHost"), embedded: true,
      get: () => S, save,
      studioUrl: () => (S.appUrl || "").trim() || DEFAULT_STUDIO,
      studio: (script) => chrome.runtime.sendMessage({ type: "OPEN_DRAWSCRIPT_APP", script, source: "lab" })
    });
    player.apply();
    renderLibrary();
    const id = new URLSearchParams(location.search).get("id");
    if (id) window.DrawScriptLibrary.get(id, (it) => { if (it) show(it.script); });
    else if (new URLSearchParams(location.search).get("tab")) tab(new URLSearchParams(location.search).get("tab"));
  });
})();
