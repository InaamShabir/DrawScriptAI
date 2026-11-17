// DrawScript 3D Standalone Engine for Chrome Extension Overlay
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
      if (ch === "\\") { escaped = true; current += ch; continue; }
      if (quote) { current += ch; if (ch === quote) quote = null; continue; }
      if (ch === '"' || ch === "'") { quote = ch; current += ch; continue; }
      if (/\s/.test(ch)) { if (current) { tokens.push(current); current = ""; } continue; }
      current += ch;
    }
    if (current) tokens.push(current);
    return tokens;
  }

  function isColor(v) {
    return COLORS.test(v) || /^#[0-9a-f]{3,8}$/i.test(v) || /^(rgb|rgba|hsl|hsla)\(/i.test(v);
  }

  function createStyle(args) {
    let color = "#fff", speed = 1, width = 4, glow = 0, glowColor = null;
    let opacity = 1, fill = null, dash = [], cap = "round", join = "round", duration = null, ease = "linear";

    for (const raw of args) {
      const t = String(raw);
      if (isColor(t)) { color = t; continue; }
      if (/^\d+(?:\.\d+)?x$/i.test(t)) { speed = Math.max(0.05, toNum(t.slice(0, -1), 1)); continue; }
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
    const normalized = String(source).replace(/\\\\\(/g, "\\(").replace(/\\\\\)/g, "\\)");
    const regex = /\\\(([\s\S]*?)\\\)/g;
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
        this.ctx.font = String(o.font).replace(/(\d+(?:\.\d+)?)px/g, (_, v) => Number(v) * this.camera.zoom + "px");
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
        await this.exec(`arrow ${ox} ${oy} ${oz} ${ox + len} ${oy} ${oz} ${style.color} width=${style.width}`);
        await this.exec(`arrow ${ox} ${oy} ${oz} ${ox} ${oy - len} ${oz} ${style.color} width=${style.width}`);
        await this.exec(`arrow ${ox} ${oy} ${oz} ${ox} ${oy} ${oz + len} ${style.color} width=${style.width}`);
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
