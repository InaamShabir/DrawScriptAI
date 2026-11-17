const DEFAULT_PROMPT = `You are a visual educator inside DrawScript 3D.
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

const DEFAULT_URL = "https://inaamshabir.github.io/drawScriptAI";

const autoPlayEl = document.getElementById("autoPlay");
const ttsEl = document.getElementById("ttsEnabled");
const appUrlEl = document.getElementById("appUrl");
const noteEl = document.getElementById("note");

chrome.storage.local.get(["autoPlay", "ttsEnabled", "drawscriptAppUrl"], (res) => {
  autoPlayEl.checked = Boolean(res.autoPlay);
  ttsEl.checked = res.ttsEnabled !== false;
  appUrlEl.value = res.drawscriptAppUrl || DEFAULT_URL;
});

autoPlayEl.addEventListener("change", () => {
  chrome.storage.local.set({ autoPlay: autoPlayEl.checked });
});

ttsEl.addEventListener("change", () => {
  chrome.storage.local.set({ ttsEnabled: ttsEl.checked });
});

appUrlEl.addEventListener("change", () => {
  chrome.storage.local.set({ drawscriptAppUrl: appUrlEl.value.trim() || DEFAULT_URL });
  noteEl.textContent = "Studio URL saved.";
});

document.getElementById("copyPrompt").addEventListener("click", async () => {
  await navigator.clipboard.writeText(DEFAULT_PROMPT);
  noteEl.textContent = "DrawScript prompt copied to clipboard.";
});

document.getElementById("openStudio").addEventListener("click", () => {
  const url = appUrlEl.value.trim() || DEFAULT_URL;
  chrome.tabs.create({ url });
});
