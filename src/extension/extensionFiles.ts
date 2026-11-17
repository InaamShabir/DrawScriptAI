import JSZip from 'jszip';
import { DEFAULT_SYSTEM_PROMPT } from '../data/presets';

export interface ExtensionFile {
  path: string;
  language: 'json' | 'javascript' | 'html' | 'css' | 'markdown';
  description: string;
  content: string;
}

export function buildExtensionFiles(appOrigin: string): ExtensionFile[] {
  const cleanOrigin = appOrigin.replace(/\/+$/, '');
  const originHostPattern = `${cleanOrigin}/*`;

  const manifestJson = JSON.stringify(
    {
      manifest_version: 3,
      name: 'DrawScript 3D — ChatGPT & Claude Canvas Bridge',
      version: '1.0.0',
      description:
        'Reads DrawScript \\(command\\) explanations from ChatGPT & Claude web pages and renders interactive 3D narrated lessons.',
      permissions: ['storage', 'activeTab'],
      host_permissions: [
        'https://chatgpt.com/*',
        'https://chat.openai.com/*',
        'https://claude.ai/*',
        originHostPattern,
        'http://localhost:3000/*',
      ],
      background: {
        service_worker: 'background.js',
      },
      action: {
        default_popup: 'popup.html',
        default_title: 'DrawScript 3D Bridge',
        default_icon: {
          '16': 'icons/icon16.png',
          '48': 'icons/icon48.png',
          '128': 'icons/icon128.png',
        },
      },
      icons: {
        '16': 'icons/icon16.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png',
      },
      content_scripts: [
        {
          matches: [
            'https://chatgpt.com/*',
            'https://chat.openai.com/*',
            'https://claude.ai/*',
          ],
          js: ['engine.js', 'content.js'],
          css: ['styles.css'],
          run_at: 'document_idle',
        },
        {
          matches: [originHostPattern, 'http://localhost:3000/*'],
          js: ['bridge.js'],
          run_at: 'document_idle',
        },
      ],
    },
    null,
    2
  );

  const backgroundJs = `// DrawScript 3D Background Service Worker
const DEFAULT_APP_URL = ${JSON.stringify(cleanOrigin)};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['drawscriptAppUrl', 'autoPlay', 'ttsEnabled', 'autoWrapPrompt'], (res) => {
    chrome.storage.local.set({
      drawscriptAppUrl: res.drawscriptAppUrl || DEFAULT_APP_URL,
      autoPlay: res.autoPlay ?? false,
      ttsEnabled: res.ttsEnabled ?? true,
      autoWrapPrompt: res.autoWrapPrompt ?? false
    });
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'OPEN_DRAWSCRIPT_APP') {
    const script = message.script || '';
    const source = message.source || 'chatgpt';

    chrome.storage.local.get(['drawscriptAppUrl'], (res) => {
      const baseUrl = (res.drawscriptAppUrl || DEFAULT_APP_URL).replace(/\\/+$/, '');
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
            const existing = tabs.find(
              (t) => t.url && t.url.startsWith(baseUrl)
            );
            if (existing && existing.id) {
              chrome.tabs.update(existing.id, { active: true });
              chrome.tabs.sendMessage(existing.id, {
                type: 'DELIVER_DRAWSCRIPT',
                script,
                source
              }).catch(() => {});
              sendResponse({ ok: true, reusedTab: true });
            } else {
              const encoded = encodeURIComponent(script);
              const targetUrl = encoded.length < 12000
                ? \`\${baseUrl}/#drawscript=\${encoded}\`
                : baseUrl;
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
`;

  const bridgeJs = `// DrawScript 3D Web App Bridge
// Automatically delivers captured ChatGPT / Claude scripts into the DrawScript Studio tab.
(function () {
  function forwardScript(script, source) {
    if (!script) return;
    window.postMessage(
      {
        type: 'DRAWSCRIPT_LOAD_SCRIPT',
        script,
        source: source || 'chrome-extension'
      },
      '*'
    );
  }

  // Check if a recent pending script is waiting in chrome.storage.local
  chrome.storage.local.get(['pendingScript'], (res) => {
    const pending = res.pendingScript;
    if (pending && pending.script && Date.now() - pending.timestamp < 120000) {
      setTimeout(() => {
        forwardScript(pending.script, pending.source);
        chrome.storage.local.remove('pendingScript');
      }, 400);
    }
  });

  // Listen for live deliveries from background.js
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'DELIVER_DRAWSCRIPT' && msg.script) {
      forwardScript(msg.script, msg.source);
      chrome.storage.local.remove('pendingScript');
    }
  });
})();
`;

  const engineJs = `// DrawScript 3D Standalone Engine for Chrome Extension Overlay
(function (global) {
  "use strict";

  const COLORS =
    /^(red|green|blue|yellow|orange|purple|pink|white|black|cyan|magenta|lime|gold|gray|grey|brown|navy|teal|aqua|maroon|silver)$/i;

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function toNum(v, fb = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fb;
  }

  function stripQuotes(v) {
    if (typeof v !== "string") return v;
    if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      return v.slice(1, -1);
    }
    return v;
  }

  function isNumberToken(v) {
    return v != null && v !== "" && Number.isFinite(Number(v));
  }

  function point3(x, y, z = 0) {
    return { x: toNum(x), y: toNum(y), z: toNum(z) };
  }

  function tokenize(cmd) {
    const tokens = [];
    let current = "";
    let quote = null;
    let escaped = false;
    for (const ch of String(cmd).trim()) {
      if (escaped) { current += ch; escaped = false; continue; }
      if (ch === "\\\\") { escaped = true; current += ch; continue; }
      if (quote) { current += ch; if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
      if (/\\s/.test(ch)) { if (current) { tokens.push(current); current = ""; } continue; }
      current += ch;
    }
    if (current) tokens.push(current);
    return tokens;
  }

  function isColor(v) {
    return COLORS.test(v) || /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|rgba|hsl|hsla)\\(/i.test(v);
  }

  function createStyle(args) {
    let color = "#fff", speed = 1, width = 4, glow = 0, glowColor = null;
    let opacity = 1, fill = null, dash = [], cap = "round", join = "round", duration = null, ease = "linear";

    for (const raw of args) {
      const t = String(raw);
      if (isColor(t)) { color = t; continue; }
      if (/^\\d+(?:\\.\\d+)?x$/i.test(t)) { speed = Math.max(0.05, toNum(t.slice(0, -1), 1)); continue; }
      if (t.startsWith("color=")) color = stripQuotes(t.slice(6));
      else if (t.startsWith("width=")) width = toNum(t.slice(6), 4);
      else if (t.startsWith("w=")) width = toNum(t.slice(2), 4);
      else if (t.startsWith("glow=")) glow = toNum(t.slice(5), 0);
      else if (t.startsWith("glowcolor=")) glowColor = stripQuotes(t.slice(10));
      else if (t.startsWith("opacity=")) opacity = clamp(toNum(t.slice(8), 1), 0, 1);
      else if (t.startsWith("alpha=")) opacity = clamp(toNum(t.slice(6), 1), 0, 1);
      else if (t.startsWith("fill=")) fill = stripQuotes(t.slice(5));
      else if (t.startsWith("dash=")) dash = t.slice(5).split(",").map(Number).filter(Number.isFinite);
      else if (t.startsWith("cap=")) cap = t.slice(4);
      else if (t.startsWith("join=")) join = t.slice(5);
      else if (t.startsWith("duration=")) duration = parseFloat(t.slice(9)) || 1;
      else if (t.startsWith("speed=")) speed = Math.max(0.05, toNum(t.slice(6), 1));
      else if (t.startsWith("ease=")) ease = t.slice(5);
    }
    return { color, speed, width, glow, glowColor: glowColor || color, opacity, fill, dash, cap, join, duration, ease };
  }

  function parseScript(source) {
    const normalized = String(source).replace(/\\\\\\\\\\(/g, "\\\\(").replace(/\\\\\\\\\\)/g, "\\\\)");
    const regex = /\\\\\\(([\\s\\S]*?)\\\\\\)/g;
    const parts = [];
    let last = 0, match;
    while ((match = regex.exec(normalized))) {
      const speech = normalized.slice(last, match.index);
      if (speech.trim()) parts.push({ type: "speech", text: speech.trim() });
      if (match[1].trim()) parts.push({ type: "draw", command: match[1].trim() });
      last = regex.lastIndex;
    }
    const rem = normalized.slice(last);
    if (rem.trim()) parts.push({ type: "speech", text: rem.trim() });
    return parts;
  }

  class DrawScriptOverlayEngine {
    constructor(canvas, onStatus) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.onStatus = onStatus || function () {};
      this.scene = [];
      this.stopped = false;
      this.ttsEnabled = true;
      this.width = canvas.clientWidth || 560;
      this.height = canvas.clientHeight || 380;
      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.camera = { yaw: 0, pitch: 0, roll: 0, zoom: 0.72, target: { x: 400, y: 300, z: 0 } };
      this.resize();
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.width = Math.max(240, r.width || 560);
      this.height = Math.max(180, r.height || 380);
      this.dpr = Math.max(1, window.devicePixelRatio || 1);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.render();
    }

    resetCamera() {
      this.camera = { yaw: 0, pitch: 0, roll: 0, zoom: 0.72, target: { x: 400, y: 300, z: 0 } };
      this.render();
    }

    orbit(dx, dy) {
      this.camera.yaw -= dx * 0.008;
      this.camera.pitch = clamp(this.camera.pitch - dy * 0.008, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
      this.render();
    }

    zoomBy(f) {
      this.camera.zoom = clamp(this.camera.zoom * f, 0.1, 10);
      this.render();
    }

    stop() {
      this.stopped = true;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }

    clear() {
      this.scene.length = 0;
      this.render();
    }

    worldToCamera(p) {
      const dx = p.x - this.camera.target.x;
      const dy = p.y - this.camera.target.y;
      const dz = p.z - this.camera.target.z;
      const cy = Math.cos(this.camera.yaw), sy = Math.sin(this.camera.yaw);
      const x1 = cy * dx - sy * dz, z1 = sy * dx + cy * dz;
      const cp = Math.cos(this.camera.pitch), sp = Math.sin(this.camera.pitch);
      const y2 = cp * dy - sp * z1, z2 = sp * dy + cp * z1;
      const cr = Math.cos(this.camera.roll), sr = Math.sin(this.camera.roll);
      return { x: cr * x1 - sr * y2, y: sr * x1 + cr * y2, z: z2 };
    }

    project(p) {
      const c = this.worldToCamera(p);
      return { x: this.width / 2 + c.x * this.camera.zoom, y: this.height / 2 + c.y * this.camera.zoom, depth: c.z };
    }

    applyStyle(s) {
      this.ctx.strokeStyle = s.color;
      this.ctx.fillStyle = s.fill || s.color;
      this.ctx.globalAlpha = s.opacity;
      this.ctx.lineWidth = Math.max(0.5, s.width * this.camera.zoom);
      this.ctx.lineCap = s.cap;
      this.ctx.lineJoin = s.join;
      this.ctx.setLineDash(s.dash.map((v) => v * this.camera.zoom));
      this.ctx.shadowBlur = s.glow * this.camera.zoom;
      this.ctx.shadowColor = s.glowColor;
    }

    resetStyle() {
      this.ctx.globalAlpha = 1;
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = "transparent";
      this.ctx.setLineDash([]);
    }

    drawPath(points, progress, closed, style) {
      if (points.length < 2) return;
      const proj = points.map((p) => this.project(p));
      const segs = points.length - 1;
      const pos = clamp(progress, 0, 1) * segs;
      const whole = Math.floor(pos);
      const frac = pos - whole;
      this.ctx.beginPath();
      this.ctx.moveTo(proj[0].x, proj[0].y);
      for (let i = 1; i <= whole && i < proj.length; i++) this.ctx.lineTo(proj[i].x, proj[i].y);
      if (whole < segs) {
        const a = proj[whole], b = proj[whole + 1];
        this.ctx.lineTo(a.x + (b.x - a.x) * frac, a.y + (b.y - a.y) * frac);
      }
      if (closed && progress >= 1) this.ctx.closePath();
      this.applyStyle(style);
      this.ctx.stroke();
      if (closed && style.fill && progress >= 1) this.ctx.fill();
      this.resetStyle();
    }

    render() {
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.fillStyle = "#030712";
      this.ctx.fillRect(0, 0, this.width, this.height);
      for (const obj of this.scene) this.renderObj(obj);
      this.resetStyle();
    }

    renderObj(o) {
      const p = o.progress ?? 1;
      if (o.type === "line" || o.type === "path") {
        this.drawPath(o.points, p, Boolean(o.closed), o.style);
        if (o.arrow && p >= 1) {
          const end = this.project(o.points[1]), start = this.project(o.points[0]);
          const ang = Math.atan2(end.y - start.y, end.x - start.x);
          const head = (o.head || 12) * this.camera.zoom;
          this.ctx.save();
          this.applyStyle(o.style);
          this.ctx.beginPath();
          this.ctx.moveTo(end.x, end.y);
          this.ctx.lineTo(end.x - head * Math.cos(ang - 0.55), end.y - head * Math.sin(ang - 0.55));
          this.ctx.moveTo(end.x, end.y);
          this.ctx.lineTo(end.x - head * Math.cos(ang + 0.55), end.y - head * Math.sin(ang + 0.55));
          this.ctx.stroke();
          this.ctx.restore();
        }
      } else if (o.type === "curve") {
        this.drawPath(o.samples, p, false, o.style);
      } else if (o.type === "point") {
        const pt = this.project(o.position);
        this.applyStyle(o.style);
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, Math.max(0.5, o.radius * p * this.camera.zoom), 0, Math.PI * 2);
        this.ctx.fill();
        this.resetStyle();
      } else if (o.type === "ellipse") {
        const end = o.start + (o.end - o.start) * p;
        const pts = [];
        for (let i = 0; i <= 90; i++) {
          const t = o.start + (end - o.start) * (i / 90);
          if (o.plane === "xz") pts.push({ x: o.center.x + o.rx * Math.cos(t), y: o.center.y, z: o.center.z + o.ry * Math.sin(t) });
          else if (o.plane === "yz") pts.push({ x: o.center.x, y: o.center.y + o.rx * Math.cos(t), z: o.center.z + o.ry * Math.sin(t) });
          else pts.push({ x: o.center.x + o.rx * Math.cos(t), y: o.center.y + o.ry * Math.sin(t), z: o.center.z });
        }
        this.drawPath(pts, 1, o.closed, o.style);
      } else if (o.type === "cylinder" || o.type === "cone") {
        const faces = o.geometry.sideFaces;
        const vis = Math.max(1, Math.ceil(faces.length * p));
        for (let i = 0; i < vis && i < faces.length; i++) {
          const pr = faces[i].map((pt) => this.project(pt));
          this.ctx.beginPath();
          this.ctx.moveTo(pr[0].x, pr[0].y);
          for (let j = 1; j < pr.length; j++) this.ctx.lineTo(pr[j].x, pr[j].y);
          this.ctx.closePath();
          this.applyStyle(o.style);
          if (o.style.fill) this.ctx.fill();
          this.ctx.stroke();
          this.resetStyle();
        }
      } else if (o.type === "text") {
        const pt = this.project(o.position);
        this.ctx.save();
        this.ctx.globalAlpha = o.opacity * p;
        this.ctx.fillStyle = o.color;
        this.ctx.font = String(o.font).replace(/(\\d+(?:\\.\\d+)?)px/g, (_, v) => Number(v) * this.camera.zoom + "px");
        this.ctx.textAlign = o.align;
        this.ctx.fillText(o.text, pt.x, pt.y);
        this.ctx.restore();
      } else if (o.type === "highlight") {
        const pt = this.project(o.center);
        this.ctx.save();
        this.ctx.globalAlpha = o.style.opacity * 0.35 * p;
        this.ctx.strokeStyle = o.style.color;
        this.ctx.lineWidth = o.style.width * this.camera.zoom;
        this.ctx.beginPath();
        this.ctx.arc(pt.x, pt.y, o.radius * this.camera.zoom, 0, Math.PI * 2);
        this.ctx.stroke();
        this.ctx.restore();
      } else if (o.type === "grid") {
        const lines = [];
        for (let i = 0; i <= o.cols; i++) lines.push([{ x: o.x + i * o.cell, y: o.y, z: o.z }, { x: o.x + i * o.cell, y: o.y + o.rows * o.cell, z: o.z }]);
        for (let j = 0; j <= o.rows; j++) lines.push([{ x: o.x, y: o.y + j * o.cell, z: o.z }, { x: o.x + o.cols * o.cell, y: o.y + j * o.cell, z: o.z }]);
        const count = Math.ceil(lines.length * p);
        for (let i = 0; i < count; i++) this.drawPath(lines[i], 1, false, o.style);
      }
    }

    animate(obj, sec) {
      obj.progress = 0;
      this.scene.push(obj);
      const ms = Math.max(20, sec * 1000);
      const start = performance.now();
      return new Promise((resolve) => {
        const frame = (now) => {
          if (this.stopped) { obj.progress = 1; this.render(); resolve(); return; }
          const raw = clamp((now - start) / ms, 0, 1);
          obj.progress = raw;
          this.render();
          if (raw < 1) requestAnimationFrame(frame);
          else { obj.progress = 1; this.render(); resolve(); }
        };
        requestAnimationFrame(frame);
      });
    }

    async exec(cmdStr) {
      const tokens = tokenize(cmdStr);
      if (!tokens.length) return;
      const name = tokens[0].toLowerCase();
      const args = tokens.slice(1);
      const nums = [];
      let idx = 0;
      while (idx < args.length && isNumberToken(args[idx])) { nums.push(toNum(args[idx])); idx++; }
      const style = createStyle(args.slice(idx));

      if (name === "clear") { this.clear(); return; }
      if (name === "wait") { await new Promise((r) => setTimeout(r, (nums[0] || 1) * 1000)); return; }
      if (name === "line" || name === "arrow") {
        const pts = nums.length >= 6
          ? [point3(nums[0], nums[1], nums[2]), point3(nums[3], nums[4], nums[5])]
          : [point3(nums[0] || 0, nums[1] || 0, 0), point3(nums[2] || 100, nums[3] || 100, 0)];
        await this.animate({ type: "line", points: pts, style, arrow: name === "arrow", head: 12 }, 0.7 / style.speed);
      } else if (name === "axes") {
        const ox = nums[0] ?? 400, oy = nums[1] ?? 300, oz = nums.length >= 4 ? nums[2] : 0;
        const len = nums.length >= 4 ? nums[3] : (nums[2] ?? 180);
        await this.exec(\`arrow \${ox} \${oy} \${oz} \${ox + len} \${oy} \${oz} \${style.color} width=\${style.width}\`);
        await this.exec(\`arrow \${ox} \${oy} \${oz} \${ox} \${oy - len} \${oz} \${style.color} width=\${style.width}\`);
        await this.exec(\`arrow \${ox} \${oy} \${oz} \${ox} \${oy} \${oz + len} \${style.color} width=\${style.width}\`);
      } else if (name === "circle" || name === "ellipse" || name === "arc") {
        const hasZ = (name === "circle" && nums.length >= 4) || (name === "ellipse" && nums.length >= 5) || (name === "arc" && nums.length >= 6);
        const c = hasZ ? point3(nums[0], nums[1], nums[2]) : point3(nums[0] || 400, nums[1] || 300, 0);
        const rx = hasZ ? nums[3] : nums[2];
        const ry = name === "ellipse" ? (hasZ ? nums[4] : nums[3]) : rx;
        const start = name === "arc" ? (hasZ ? nums[4] : nums[3]) : 0;
        const end = name === "arc" ? (hasZ ? nums[5] : nums[4]) : Math.PI * 2;
        let plane = "xy";
        for (const t of args.slice(idx)) if (t.startsWith("plane=")) plane = t.slice(6);
        await this.animate({ type: "ellipse", center: c, rx, ry, start, end, closed: name !== "arc", plane, style }, 0.7 / style.speed);
      } else if (name === "rect" || name === "rectangle") {
        const x = nums[0] || 0, y = nums[1] || 0, z = nums.length >= 5 ? nums[2] : 0;
        const w = nums.length >= 5 ? nums[3] : nums[2], h = nums.length >= 5 ? nums[4] : nums[3];
        await this.animate({ type: "path", points: [point3(x, y, z), point3(x + w, y, z), point3(x + w, y + h, z), point3(x, y + h, z)], closed: true, style }, 0.7 / style.speed);
      } else if (name === "triangle" || name === "polygon" || name === "polyline") {
        const pts = [];
        const is3d = (nums.length >= 9 && nums.length % 3 === 0 && nums.length % 2 !== 0) || args.includes("3d");
        const step = is3d ? 3 : 2;
        for (let i = 0; i < nums.length; i += step) pts.push(point3(nums[i], nums[i + 1], is3d ? nums[i + 2] : 0));
        await this.animate({ type: "path", points: pts, closed: name !== "polyline", style }, 0.8 / style.speed);
      } else if (name === "quadratic") {
        const p0 = point3(nums[0], nums[1]), pc = point3(nums[2], nums[3]), p1 = point3(nums[4], nums[5]);
        const samples = [];
        for (let i = 0; i <= 80; i++) {
          const t = i / 80, u = 1 - t;
          samples.push({ x: u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x, y: u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y, z: 0 });
        }
        await this.animate({ type: "curve", samples, style }, 0.8 / style.speed);
      } else if (name === "bezier" || name === "cubic") {
        const p0 = point3(nums[0], nums[1]), c1 = point3(nums[2], nums[3]), c2 = point3(nums[4], nums[5]), p1 = point3(nums[6], nums[7]);
        const samples = [];
        for (let i = 0; i <= 100; i++) {
          const t = i / 100, u = 1 - t;
          samples.push({
            x: u*u*u*p0.x + 3*u*u*t*c1.x + 3*u*t*t*c2.x + t*t*t*p1.x,
            y: u*u*u*p0.y + 3*u*u*t*c1.y + 3*u*t*t*c2.y + t*t*t*p1.y,
            z: 0
          });
        }
        await this.animate({ type: "curve", samples, style }, 0.9 / style.speed);
      } else if (name === "cylinder" || name === "cone") {
        const c = point3(nums[0], nums[1], nums[2]), r = nums[3], h = nums[4], segs = 48;
        const bottom = [], top = [], sideFaces = [];
        for (let i = 0; i < segs; i++) {
          const t = (i / segs) * Math.PI * 2;
          const x = c.x + r * Math.cos(t), z = c.z + r * Math.sin(t);
          bottom.push(point3(x, c.y, z));
          top.push(point3(x, c.y - h, z));
        }
        const apex = point3(c.x, c.y - h, c.z);
        for (let i = 0; i < segs; i++) {
          const nx = (i + 1) % segs;
          sideFaces.push(name === "cylinder" ? [bottom[i], bottom[nx], top[nx], top[i]] : [bottom[i], bottom[nx], apex]);
        }
        await this.animate({ type: name, geometry: { sideFaces }, style }, 1.1 / style.speed);
      } else if (name === "point" || name === "dot") {
        const z = nums.length >= 4 ? nums[2] : 0;
        const r = nums.length >= 4 ? nums[3] : (nums[2] ?? 6);
        await this.animate({ type: "point", position: point3(nums[0], nums[1], z), radius: r, style }, 0.35);
      } else if (name === "text" || name === "label") {
        const x = toNum(args[0]), y = toNum(args[1]), text = stripQuotes(args[2]);
        let z = 0, st = 3;
        if (isNumberToken(args[3])) { z = toNum(args[3]); st = 4; }
        let color = "#fff", font = "20px sans-serif", align = "left";
        for (const t of args.slice(st)) {
          if (isColor(t)) color = t;
          else if (t.startsWith("font=")) font = stripQuotes(t.slice(5));
          else if (t.startsWith("align=")) align = t.slice(6);
        }
        await this.animate({ type: "text", position: point3(x, y, z), text, color, font, align, opacity: 1 }, 0.3);
      } else if (name === "highlight") {
        const c = nums.length >= 4 ? point3(nums[0], nums[1], nums[2]) : point3(nums[0], nums[1]);
        const r = nums.length >= 4 ? nums[3] : nums[2];
        await this.animate({ type: "highlight", center: c, radius: r, style }, 0.5);
      } else if (name === "grid") {
        const x = nums[0], y = nums[1], z = nums.length >= 6 ? nums[2] : 0;
        const cell = nums.length >= 6 ? nums[3] : nums[2];
        const rows = Math.floor(nums.length >= 6 ? nums[4] : nums[3]);
        const cols = Math.floor(nums.length >= 6 ? nums[5] : nums[4]);
        await this.animate({ type: "grid", x, y, z, cell, rows, cols, style }, 0.4);
      }
    }

    async play(source) {
      this.stop();
      this.stopped = false;
      this.clear();
      const parts = parseScript(source);
      for (const part of parts) {
        if (this.stopped) break;
        if (part.type === "speech") {
          this.onStatus(part.text);
          if (this.ttsEnabled && window.speechSynthesis) {
            await new Promise((res) => {
              const u = new SpeechSynthesisUtterance(part.text);
              u.onend = res; u.onerror = res;
              window.speechSynthesis.speak(u);
            });
          }
        } else if (part.type === "draw") {
          this.onStatus("Drawing: " + part.command);
          await this.exec(part.command).catch(() => {});
        }
      }
      if (!this.stopped) this.onStatus("Finished · Drag canvas to orbit in 3D");
    }
  }

  global.DrawScriptOverlayEngine = DrawScriptOverlayEngine;
  global.DrawScriptParse = parseScript;
})(window);
`;

  const contentJs = `// DrawScript 3D Content Script for ChatGPT & Claude
(function () {
  "use strict";

  const DRAWSCRIPT_SYSTEM_PROMPT = ${JSON.stringify(DEFAULT_SYSTEM_PROMPT)};

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

  // KaTeX-aware DOM walker so \\( ... \\) math delimiters inside ChatGPT replies are preserved cleanly
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

      // Recover original TeX when ChatGPT renders \\(cmd\\) via KaTeX
      if (el.classList && (el.classList.contains("katex") || el.classList.contains("katex-display"))) {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        if (ann && ann.textContent) {
          out += "\\\\(" + ann.textContent.trim() + "\\\\)";
          return;
        }
      }

      if (el.tagName === "BR") {
        out += "\\n";
        return;
      }

      const isBlock = /^(P|DIV|LI|PRE|H1|H2|H3|H4|BLOCKQUOTE)$/i.test(el.tagName);
      for (const child of el.childNodes) {
        walk(child);
      }
      if (isBlock) out += "\\n";
    }

    walk(root);
    return out
      .replace(/\\\\\\\\\\(/g, "\\\\(")
      .replace(/\\\\\\\\\\)/g, "\\\\)")
      .replace(/\\n{3,}/g, "\\n\\n")
      .trim();
  }

  function hasDrawScriptCommands(text) {
    return /\\\\\\([a-zA-Z]+\\s+[^\\)]+\\\\\\)/.test(text);
  }

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement("div");
    overlayEl.className = "ds3d-overlay";
    overlayEl.innerHTML = \`
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
    \`;

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

  // Inject "Wrap with DrawScript Prompt" helper near ChatGPT / Claude prompt box
  function ensureComposerHelper() {
    // Keep our control outside ChatGPT/Claude's framework-owned DOM. Injecting
    // siblings beside the composer can upset its DOM reconciliation/runtime.
    let host = document.getElementById("ds3d-composer-helper-host");
    if (!host) {
      host = document.createElement("div");
      host.id = "ds3d-composer-helper-host";
      host.style.cssText = "position:fixed;right:24px;bottom:104px;z-index:2147483646;";
      const shadow = host.attachShadow({ mode: "open" });
      shadow.innerHTML = `
        <style>
          button {
            appearance:none;border:1px solid #0284c7;border-radius:9px;
            background:#0369a1;color:#fff;padding:9px 13px;
            font:600 12px/1.2 system-ui,sans-serif;cursor:pointer;
            box-shadow:0 4px 16px #0005;
          }
          button:hover { background:#0284c7; }
          button:focus-visible { outline:2px solid #7dd3fc;outline-offset:3px; }
        </style>
        <button type="button">+ Wrap DrawScript Prompt</button>
      `;
      const button = shadow.querySelector("button");
      button.addEventListener("click", () => {
        const composer =
          document.querySelector("#prompt-textarea") ||
          document.querySelector('[contenteditable="true"][data-lexical-editor="true"]') ||
          document.querySelector('div[contenteditable="true"].ProseMirror') ||
          document.querySelector('[contenteditable="true"][role="textbox"]') ||
          document.querySelector("textarea");

        if (!composer || !composer.isConnected) {
          button.textContent = "Chat input not found";
          return;
        }

        const isTextarea = composer.tagName === "TEXTAREA";
        const currentVal = isTextarea
          ? composer.value
          : (composer.innerText || composer.textContent || "");
        if (currentVal.includes("DrawScript 3D")) {
          button.textContent = "Prompt already added";
          return;
        }

        const wrapped = DRAWSCRIPT_SYSTEM_PROMPT + "\\n\\nStudent Question: " +
          (currentVal.trim() || "Explain the Pythagorean theorem visually.");
        composer.focus();

        if (isTextarea) {
          const setter = Object.getOwnPropertyDescriptor(
            HTMLTextAreaElement.prototype, "value"
          )?.set;
          if (setter) setter.call(composer, wrapped);
          else composer.value = wrapped;
          composer.dispatchEvent(new InputEvent("input", {
            bubbles: true, inputType: "insertText", data: wrapped
          }));
          composer.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          // Use the editor's native insertion command so its framework state
          // receives a proper editing transaction. Never mutate its DOM with
          // Range.insertNode: that leaves React/ProseMirror state out of sync.
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(composer);
          if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
          }

          let inserted = false;
          try {
            inserted = document.execCommand("insertText", false, wrapped);
          } catch {
            inserted = false;
          }
          const updatedText = composer.innerText || composer.textContent || "";
          if (!inserted && !updatedText.includes("Student Question:")) {
            button.textContent = "Insertion blocked — copying prompt";
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(wrapped).then(() => {
                button.textContent = "Prompt copied — paste into chat";
              }).catch(() => {
                button.textContent = "Copy blocked — use app prompt";
              });
            } else {
              button.textContent = "Insertion blocked — use app prompt";
            }
            return;
          }
        }

        button.textContent = "DrawScript Prompt Added";
        setTimeout(() => { button.textContent = "+ Wrap DrawScript Prompt"; }, 2200);
      });
      document.documentElement.appendChild(host);
    }
  }

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
`;

  const stylesCss = `/* Scoped styles for DrawScript 3D ChatGPT/Claude Extension */
.ds3d-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid rgba(148, 163, 184, 0.2);
}

.ds3d-action-btn {
  appearance: none;
  border: 1px solid #334155;
  background: #0f172a;
  color: #e2e8f0;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
}

.ds3d-action-btn:hover {
  background: #1e293b;
}

.ds3d-action-primary {
  background: #0284c7;
  border-color: #0ea5e9;
  color: #ffffff;
}

.ds3d-action-primary:hover {
  background: #0369a1;
}

.ds3d-composer-btn {
  display: inline-flex;
  align-items: center;
  margin-bottom: 6px;
  border: 1px solid rgba(56, 189, 248, 0.4);
  background: rgba(15, 23, 42, 0.9);
  color: #7dd3fc;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.ds3d-composer-btn:hover {
  background: rgba(2, 132, 199, 0.25);
}

.ds3d-overlay {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: min(620px, calc(100vw - 40px));
  height: 480px;
  z-index: 2147483647;
  display: none;
  flex-direction: column;
  background: #0b1120;
  border: 1px solid #334155;
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.ds3d-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}

.ds3d-title {
  color: #f8fafc;
  font-size: 13px;
  font-weight: 700;
}

.ds3d-controls {
  display: flex;
  gap: 6px;
}

.ds3d-btn {
  border: 1px solid #334155;
  background: #1e293b;
  color: #e2e8f0;
  border-radius: 6px;
  padding: 4px 9px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.ds3d-btn-primary {
  background: #0284c7;
  border-color: #0ea5e9;
  color: #ffffff;
}

.ds3d-stage {
  flex: 1;
  position: relative;
  background: #030712;
}

.ds3d-canvas {
  width: 100%;
  height: 100%;
  display: block;
  cursor: grab;
}

.ds3d-caption {
  padding: 9px 14px;
  background: #0f172a;
  border-top: 1px solid #1e293b;
  color: #cbd5e1;
  font-size: 12px;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;

  const popupHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>DrawScript 3D Bridge</title>
  <style>
    body {
      margin: 0;
      width: 320px;
      padding: 16px;
      background: #0b1120;
      color: #f1f5f9;
      font-family: system-ui, -apple-system, sans-serif;
    }
    h1 { font-size: 15px; margin: 0 0 4px; }
    p { font-size: 12px; color: #94a3b8; margin: 0 0 14px; line-height: 1.45; }
    label { display: flex; align-items: center; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #1e293b; }
    .field { margin-top: 12px; }
    .field span { display: block; font-size: 11px; color: #94a3b8; margin-bottom: 4px; }
    input[type="text"] {
      width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 6px;
      border: 1px solid #334155; background: #0f172a; color: #f8fafc; font-size: 12px;
    }
    .actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 14px; }
    button {
      padding: 8px 10px; border-radius: 7px; border: 1px solid #334155;
      background: #1e293b; color: #f8fafc; font-size: 12px; font-weight: 600; cursor: pointer;
    }
    button.primary { background: #0284c7; border-color: #0ea5e9; }
    .note { margin-top: 10px; font-size: 11px; color: #38bdf8; min-height: 15px; }
  </style>
</head>
<body>
  <h1>DrawScript 3D Bridge</h1>
  <p>Reads DrawScript commands directly from your ChatGPT or Claude page—works on Free &amp; Plus accounts.</p>

  <label>
    <span>Auto-play new AI replies</span>
    <input type="checkbox" id="autoPlay" />
  </label>
  <label>
    <span>Voice narration (TTS)</span>
    <input type="checkbox" id="ttsEnabled" checked />
  </label>

  <div class="field">
    <span>DrawScript Studio App URL</span>
    <input type="text" id="appUrl" />
  </div>

  <div class="actions">
    <button id="copyPrompt">Copy Prompt</button>
    <button id="openStudio" class="primary">Open Studio</button>
  </div>
  <div id="note" class="note"></div>
  <script src="popup.js"></script>
</body>
</html>
`;

  const popupJs = `const DEFAULT_PROMPT = ${JSON.stringify(DEFAULT_SYSTEM_PROMPT)};
const DEFAULT_URL = ${JSON.stringify(cleanOrigin)};

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
`;

  const readmeMd = `# DrawScript 3D Chrome Extension (Manifest V3)

Turn any free or paid ChatGPT / Claude conversation into a live, animated 3D visual lesson.

## Installation (Chrome / Edge / Brave)

1. Unzip this folder onto your computer.
2. Open \`chrome://extensions\` in your browser.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select this unzipped folder.

## How to Use

1. Open **https://chatgpt.com** (or **https://claude.ai**).
2. Click **+ Wrap DrawScript Prompt** above the chat input box (or copy the prompt from the extension popup), type your question (e.g., *"Explain the Pythagorean theorem"*), and press Send.
3. As soon as ChatGPT responds with \`\\(command ...\\)\` blocks, click **Play in DrawScript 3D** to watch it draw directly inside an interactive 3D overlay on ChatGPT—or click **Send to DrawScript App** to load it into your full DrawScript Studio tab.
`;

  return [
    {
      path: 'manifest.json',
      language: 'json',
      description: 'Manifest V3 extension configuration for chatgpt.com, claude.ai, and DrawScript Studio bridge.',
      content: manifestJson,
    },
    {
      path: 'content.js',
      language: 'javascript',
      description: 'DOM MutationObserver, KaTeX-aware response extractor, prompt wrapper button, and 3D overlay launcher.',
      content: contentJs,
    },
    {
      path: 'engine.js',
      language: 'javascript',
      description: 'Standalone 3D orthographic DrawScript canvas & Web Speech TTS engine embedded in the extension.',
      content: engineJs,
    },
    {
      path: 'bridge.js',
      language: 'javascript',
      description: 'Cross-tab bridge script that forwards captured ChatGPT responses straight into DrawScript Studio.',
      content: bridgeJs,
    },
    {
      path: 'background.js',
      language: 'javascript',
      description: 'Manifest V3 service worker managing storage preferences and tab routing.',
      content: backgroundJs,
    },
    {
      path: 'popup.html',
      language: 'html',
      description: 'Extension toolbar popup for toggling Auto-Play, TTS narration, and Studio URL.',
      content: popupHtml,
    },
    {
      path: 'popup.js',
      language: 'javascript',
      description: 'Popup UI controller wired to chrome.storage.local and clipboard.',
      content: popupJs,
    },
    {
      path: 'styles.css',
      language: 'css',
      description: 'Scoped .ds3d-* styles for the injected ChatGPT buttons and floating 3D overlay.',
      content: stylesCss,
    },
    {
      path: 'README.md',
      language: 'markdown',
      description: 'Quick-start instructions for loading the unpacked Chrome extension.',
      content: readmeMd,
    },
  ];
}

function renderIconBlob(size: number): Promise<Blob> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0B1120';
    ctx.fillRect(0, 0, size, size);

    // Technical isometric cube wireframe mark
    const cx = size / 2;
    const cy = size / 2;
    const r = size * 0.34;
    ctx.strokeStyle = '#38BDF8';
    ctx.lineWidth = Math.max(1.5, size * 0.08);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 3) * i - Math.PI / 2;
      const x = cx + r * Math.cos(ang);
      const y = cy + r * Math.sin(ang);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.strokeStyle = '#F59E0B';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx - r * Math.cos(Math.PI / 6), cy - r * Math.sin(Math.PI / 6));
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + r * Math.cos(Math.PI / 6), cy - r * Math.sin(Math.PI / 6));
    ctx.stroke();

    canvas.toBlob((blob) => {
      resolve(blob || new Blob());
    }, 'image/png');
  });
}

export async function downloadExtensionZip(appOrigin: string): Promise<void> {
  const zip = new JSZip();
  const files = buildExtensionFiles(appOrigin);

  for (const file of files) {
    zip.file(file.path, file.content);
  }

  const [icon16, icon48, icon128] = await Promise.all([
    renderIconBlob(16),
    renderIconBlob(48),
    renderIconBlob(128),
  ]);

  zip.file('icons/icon16.png', icon16);
  zip.file('icons/icon48.png', icon48);
  zip.file('icons/icon128.png', icon128);

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'drawscript-3d-chrome-extension.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
