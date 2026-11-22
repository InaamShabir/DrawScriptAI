// DrawScript 3D Standalone Engine for Chrome Extension Overlay
(function (global) {
  "use strict";

  const COLORS =
    /^(red|green|blue|yellow|orange|purple|pink|white|black|cyan|magenta|lime|gold|gray|grey|brown|navy|teal|aqua|maroon|silver|indigo|violet|coral|salmon|crimson|olive|turquoise|skyblue|lightblue|orchid|tomato|khaki|plum|slategray|slategrey|transparent)$/i;

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

  // Safe math-expression compiler for the `plot` command (no eval / Function).
  const compileExpression = (function () {
  var __defProp = Object.defineProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  const CONSTANTS = {
    pi: Math.PI,
    e: Math.E,
    tau: Math.PI * 2
  };
  const FUNCTIONS = {
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    asin: Math.asin,
    acos: Math.acos,
    atan: Math.atan,
    atan2: Math.atan2,
    sinh: Math.sinh,
    cosh: Math.cosh,
    tanh: Math.tanh,
    sqrt: Math.sqrt,
    cbrt: Math.cbrt,
    abs: Math.abs,
    ln: Math.log,
    log: Math.log10,
    log2: Math.log2,
    exp: Math.exp,
    floor: Math.floor,
    ceil: Math.ceil,
    round: Math.round,
    sign: Math.sign,
    min: Math.min,
    max: Math.max,
    pow: Math.pow
  };
  function tokenize(src) {
    const out = [];
    const s = src.replace(/π/g, " pi ").replace(/\s+/g, " ");
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === " ") {
        i++;
        continue;
      }
      if (/[0-9.]/.test(ch)) {
        const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
        if (!m) throw new Error(`bad number near "${s.slice(i, i + 6)}"`);
        out.push({ t: "num", v: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if (/[a-zA-Z_]/.test(ch)) {
        const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i));
        out.push({ t: "id", v: m[0].toLowerCase() });
        i += m[0].length;
        continue;
      }
      if (ch === "*" && s[i + 1] === "*") {
        out.push({ t: "op", v: "^" });
        i += 2;
        continue;
      }
      if ("+-*/%^(),".includes(ch)) {
        out.push({ t: "op", v: ch });
        i++;
        continue;
      }
      throw new Error(`unexpected character "${ch}"`);
    }
    return out;
  }
  const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
  class Parser {
    constructor(tokens) {
      __publicField(this, "tokens", tokens);
      __publicField(this, "pos", 0);
    }
    parse() {
      const node = this.expr();
      if (this.pos < this.tokens.length) {
        throw new Error("unexpected trailing input");
      }
      return node;
    }
    peek() {
      return this.tokens[this.pos];
    }
    isOp(v) {
      const t = this.peek();
      return !!t && t.t === "op" && t.v === v;
    }
    expr() {
      let left = this.term();
      while (this.isOp("+") || this.isOp("-")) {
        const op = this.tokens[this.pos++].v;
        left = { k: "bin", op, a: left, b: this.term() };
      }
      return left;
    }
    startsPrimary() {
      const t = this.peek();
      if (!t) return false;
      return t.t === "num" || t.t === "id" || t.t === "op" && t.v === "(";
    }
    term() {
      let left = this.unary();
      for (; ; ) {
        if (this.isOp("*") || this.isOp("/") || this.isOp("%")) {
          const op = this.tokens[this.pos++].v;
          left = { k: "bin", op, a: left, b: this.unary() };
        } else if (this.startsPrimary()) {
          left = { k: "bin", op: "*", a: left, b: this.unary() };
        } else {
          break;
        }
      }
      return left;
    }
    unary() {
      if (this.isOp("-") || this.isOp("+")) {
        const op = this.tokens[this.pos++].v;
        return { k: "un", op, a: this.unary() };
      }
      return this.power();
    }
    power() {
      const base = this.primary();
      if (this.isOp("^")) {
        this.pos++;
        return { k: "bin", op: "^", a: base, b: this.unary() };
      }
      return base;
    }
    primary() {
      const t = this.tokens[this.pos++];
      if (!t) throw new Error("unexpected end of expression");
      if (t.t === "num") return { k: "num", v: t.v };
      if (t.t === "id") {
        if (this.isOp("(")) {
          if (!hasOwn(FUNCTIONS, t.v)) throw new Error(`unknown function "${t.v}"`);
          this.pos++;
          const args = [];
          if (!this.isOp(")")) {
            args.push(this.expr());
            while (this.isOp(",")) {
              this.pos++;
              args.push(this.expr());
            }
          }
          if (!this.isOp(")")) throw new Error('missing ")"');
          this.pos++;
          return { k: "call", fn: t.v, args };
        }
        if (t.v === "x" || t.v === "t") return { k: "var" };
        if (hasOwn(CONSTANTS, t.v)) return { k: "num", v: CONSTANTS[t.v] };
        throw new Error(`unknown name "${t.v}"`);
      }
      if (t.v === "(") {
        const inner = this.expr();
        if (!this.isOp(")")) throw new Error('missing ")"');
        this.pos++;
        return inner;
      }
      throw new Error(`unexpected "${t.v}"`);
    }
  }
  function evaluate(node, x) {
    switch (node.k) {
      case "num":
        return node.v;
      case "var":
        return x;
      case "un":
        return node.op === "-" ? -evaluate(node.a, x) : evaluate(node.a, x);
      case "bin": {
        const a = evaluate(node.a, x);
        const b = evaluate(node.b, x);
        switch (node.op) {
          case "+":
            return a + b;
          case "-":
            return a - b;
          case "*":
            return a * b;
          case "/":
            return a / b;
          case "%":
            return a % b;
          case "^":
            return Math.pow(a, b);
        }
        return NaN;
      }
      case "call":
        return FUNCTIONS[node.fn](...node.args.map((arg) => evaluate(arg, x)));
    }
  }
  function compileExpression(source) {
    const cleaned = source.trim().replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, "").replace(/²/g, "^2").replace(/³/g, "^3");
    if (!cleaned) throw new Error("empty expression");
    const ast = new Parser(tokenize(cleaned)).parse();
    return (x) => evaluate(ast, x);
  }
    return compileExpression;
  })();

  const DEG = Math.PI / 180;
  const PALETTE = ["#38bdf8", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#fb7185", "#facc15", "#2dd4bf"];

  function withAlpha(color, alpha) {
    const hex = /^#([0-9a-f]{6})$/i.exec(color);
    if (!hex) return color;
    const n = parseInt(hex[1], 16);
    return "rgba(" + ((n >> 16) & 255) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + alpha + ")";
  }

  // `key=value` option readers shared by the newer commands.
  function optStr(tokens, keys) {
    for (const t of tokens) {
      const lower = String(t).toLowerCase();
      for (const k of keys) if (lower.startsWith(k + "=")) return stripQuotes(String(t).slice(k.length + 1));
    }
    return null;
  }
  function optNum(tokens, keys, fallback) {
    const v = optStr(tokens, keys);
    if (v == null) return fallback;
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  function hasFlag(tokens, name) {
    return tokens.some((t) => {
      const lower = String(t).toLowerCase();
      if (lower === name) return true;
      return lower.startsWith(name + "=") && /^(on|true|yes|1)$/.test(lower.slice(name.length + 1));
    });
  }
  function isOff(tokens, name) {
    const v = optStr(tokens, [name]);
    return v != null && /^(off|false|no|0)$/i.test(v);
  }
  function labelOf(tokens) {
    const named = optStr(tokens, ["label"]);
    if (named != null) return named;
    const quoted = tokens.find((t) => /^["']/.test(String(t)));
    return quoted ? stripQuotes(quoted) : "";
  }
  function leadingNums(tokens) {
    const nums = [];
    let i = 0;
    while (i < tokens.length && isNumberToken(tokens[i])) { nums.push(toNum(tokens[i])); i++; }
    return { nums, rest: tokens.slice(i) };
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
      this.bg = "#030712";
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
      this.ctx.fillStyle = this.bg;
      this.ctx.fillRect(0, 0, this.width, this.height);
      for (const obj of this.scene) this.renderObj(obj);
      this.resetStyle();
    }

    renderObj(o) {
      const p = o.progress ?? 1;
      if (o.type === "line" || o.type === "path") {
        this.drawPath(o.points, p, Boolean(o.closed), o.style);
        if (o.arrow && p >= 1) {
          const head = (o.head || 12) * this.camera.zoom;
          const ends = [[o.points[0], o.points[1]]];
          if (o.arrowStart) ends.push([o.points[1], o.points[0]]);
          for (const pair of ends) {
            const end = this.project(pair[1]), start = this.project(pair[0]);
            const ang = Math.atan2(end.y - start.y, end.x - start.x);
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
        }
      } else if (o.type === "multipath") {
        if (o.faces && o.faces.length && p > 0) {
          const faces = o.faces
            .map((f) => {
              const pr = f.points.map((pt) => this.project(pt));
              return { f, pr, depth: pr.reduce((sum, q) => sum + q.depth, 0) / pr.length };
            })
            .sort((a, b) => a.depth - b.depth);
          this.ctx.save();
          this.ctx.globalAlpha = o.style.opacity * p;
          for (const item of faces) {
            this.ctx.beginPath();
            this.ctx.moveTo(item.pr[0].x, item.pr[0].y);
            for (let j = 1; j < item.pr.length; j++) this.ctx.lineTo(item.pr[j].x, item.pr[j].y);
            this.ctx.closePath();
            this.ctx.fillStyle = item.f.fill;
            this.ctx.fill();
          }
          this.ctx.restore();
        }
        const total = o.paths.length;
        const pos = clamp(p, 0, 1) * total;
        const whole = Math.floor(pos);
        const frac = pos - whole;
        for (let i = 0; i < total && i <= whole; i++) {
          const local = i < whole ? 1 : frac;
          if (local <= 0) continue;
          const entry = o.paths[i];
          const st = Object.assign({}, o.style, {
            color: entry.color || o.style.color,
            glowColor: entry.color || o.style.glowColor,
            fill: entry.fill || null
          });
          this.drawPath(entry.points, local, Boolean(entry.closed), st);
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

    // Label that is visible immediately (used by compound commands such as pie / axes2d).
    addText(x, y, z, text, color, font, align) {
      this.scene.push({
        type: "text", progress: 1, position: point3(x, y, z), text,
        color: color || "#94a3b8", font: font || "13px sans-serif", align: align || "center", opacity: 1
      });
      this.render();
    }

    // Compound object: several stroked paths drawn one after another, plus optional filled faces.
    addMulti(paths, style, seconds, faces) {
      return this.animate({ type: "multipath", paths, faces: faces || [], style }, seconds);
    }

    animateCamera(to, seconds) {
      const keys = Object.keys(to);
      const from = { yaw: this.camera.yaw, pitch: this.camera.pitch, roll: this.camera.roll, zoom: this.camera.zoom };
      const apply = (t) => {
        for (const k of keys) this.camera[k] = from[k] + (to[k] - from[k]) * t;
        this.render();
      };
      const ms = Math.max(20, seconds * 1000);
      const start = performance.now();
      return new Promise((resolve) => {
        const frame = (now) => {
          if (this.stopped) { resolve(); return; }
          const raw = clamp((now - start) / ms, 0, 1);
          apply(raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2);
          if (raw < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    }

    // Newer commands. Returns true when `name` was handled here.
    async execExtra(name, args, style) {
      const lead = leadingNums(args);
      const v = lead.nums;
      const rest = lead.rest;
      const secs = (base) => base / style.speed;

      switch (name) {
        case "ngon": case "regular": case "pentagon": case "hexagon": case "heptagon": case "octagon": {
          const fixedSides = { pentagon: 5, hexagon: 6, heptagon: 7, octagon: 8 };
          const fixed = fixedSides[name];
          if (v.length < (fixed ? 3 : 4)) throw new Error(name + " requires cx cy radius" + (fixed ? "" : " sides"));
          const sides = Math.max(3, Math.floor(fixed || v[3]));
          const z = optNum(rest, ["z"], 0);
          const rot = optNum(rest, ["rot", "rotate"], 0) * DEG - Math.PI / 2;
          const points = [];
          for (let i = 0; i < sides; i++) {
            const a = rot + (i / sides) * Math.PI * 2;
            points.push(point3(v[0] + v[2] * Math.cos(a), v[1] + v[2] * Math.sin(a), z));
          }
          await this.animate({ type: "path", points, closed: true, style }, secs(1.0));
          return true;
        }

        case "star": {
          if (v.length < 4) throw new Error("star requires cx cy outerRadius innerRadius [points]");
          const count = Math.max(3, Math.floor(v[4] || 5));
          const z = optNum(rest, ["z"], 0);
          const rot = optNum(rest, ["rot", "rotate"], 0) * DEG - Math.PI / 2;
          const points = [];
          for (let i = 0; i < count * 2; i++) {
            const r = i % 2 === 0 ? v[2] : v[3];
            const a = rot + (i / (count * 2)) * Math.PI * 2;
            points.push(point3(v[0] + r * Math.cos(a), v[1] + r * Math.sin(a), z));
          }
          await this.animate({ type: "path", points, closed: true, style }, secs(1.1));
          return true;
        }

        case "sphere": {
          if (v.length < 3) throw new Error("sphere requires cx cy cz radius (or cx cy radius)");
          const hasZ = v.length >= 4;
          const cx = v[0], cy = v[1], cz = hasZ ? v[2] : 0, radius = hasZ ? v[3] : v[2];
          const lats = Math.max(2, Math.floor(optNum(rest, ["lat"], 6)));
          const lons = Math.max(2, Math.floor(optNum(rest, ["lon"], 6)));
          const SAMPLES = 64;
          const paths = [];
          for (let k = 1; k < lats; k++) {
            const a = -Math.PI / 2 + (k / lats) * Math.PI;
            const ring = [];
            for (let i = 0; i < SAMPLES; i++) {
              const t = (i / SAMPLES) * Math.PI * 2;
              ring.push(point3(cx + radius * Math.cos(a) * Math.cos(t), cy + radius * Math.sin(a), cz + radius * Math.cos(a) * Math.sin(t)));
            }
            paths.push({ points: ring, closed: true });
          }
          for (let j = 0; j < lons; j++) {
            const theta = (j / lons) * Math.PI;
            const loop = [];
            for (let i = 0; i < SAMPLES; i++) {
              const t = (i / SAMPLES) * Math.PI * 2;
              loop.push(point3(cx + radius * Math.cos(t) * Math.cos(theta), cy + radius * Math.sin(t), cz + radius * Math.cos(t) * Math.sin(theta)));
            }
            paths.push({ points: loop, closed: true });
          }
          style.fill = null;
          await this.addMulti(paths, style, secs(1.6));
          return true;
        }

        case "cube": case "box": {
          let cx, cy, cz, w, h, d;
          if (name === "cube") {
            if (v.length < 3) throw new Error("cube requires cx cy cz size (or cx cy size)");
            const hasZ = v.length >= 4;
            cx = v[0]; cy = v[1]; cz = hasZ ? v[2] : 0;
            w = h = d = hasZ ? v[3] : v[2];
          } else {
            if (v.length < 6) throw new Error("box requires cx cy cz width height depth");
            cx = v[0]; cy = v[1]; cz = v[2]; w = v[3]; h = v[4]; d = v[5];
          }
          const vertex = (i) => point3(cx + (i & 1 ? w / 2 : -w / 2), cy + (i & 2 ? h / 2 : -h / 2), cz + (i & 4 ? d / 2 : -d / 2));
          const paths = [];
          for (let i = 0; i < 8; i++) {
            for (const bit of [1, 2, 4]) if (!(i & bit)) paths.push({ points: [vertex(i), vertex(i | bit)] });
          }
          const faces = [];
          if (style.fill) {
            const quads = [];
            for (const s of [0, 1]) {
              quads.push([s, s | 2, s | 2 | 4, s | 4]);
              quads.push([s << 1, (s << 1) | 1, (s << 1) | 1 | 4, (s << 1) | 4]);
              quads.push([s << 2, (s << 2) | 1, (s << 2) | 1 | 2, (s << 2) | 2]);
            }
            for (const q of quads) faces.push({ points: q.map(vertex), fill: style.fill });
          }
          await this.addMulti(paths, style, secs(1.2), faces);
          return true;
        }

        case "pyramid": {
          if (v.length < 5) throw new Error("pyramid requires cx cy cz baseSize height");
          const half = v[3] / 2;
          const corners = [
            point3(v[0] - half, v[1], v[2] - half), point3(v[0] + half, v[1], v[2] - half),
            point3(v[0] + half, v[1], v[2] + half), point3(v[0] - half, v[1], v[2] + half)
          ];
          const apex = point3(v[0], v[1] - v[4], v[2]);
          const paths = [{ points: corners, closed: true }].concat(corners.map((c) => ({ points: [c, apex] })));
          const faces = [];
          if (style.fill) {
            faces.push({ points: corners, fill: style.fill });
            for (let i = 0; i < 4; i++) faces.push({ points: [corners[i], corners[(i + 1) % 4], apex], fill: style.fill });
          }
          await this.addMulti(paths, style, secs(1.2), faces);
          return true;
        }

        case "helix": {
          if (v.length < 6) throw new Error("helix requires cx cy cz radius height turns");
          const count = Math.max(24, Math.ceil(Math.abs(v[5]) * 48));
          const samples = [];
          for (let i = 0; i <= count; i++) {
            const t = i / count, a = t * v[5] * Math.PI * 2;
            samples.push(point3(v[0] + v[3] * Math.cos(a), v[1] - v[4] * t, v[2] + v[3] * Math.sin(a)));
          }
          await this.animate({ type: "curve", samples, style }, secs(1.6));
          return true;
        }

        case "spiral": {
          if (v.length < 4) throw new Error("spiral requires cx cy radius turns");
          const z = optNum(rest, ["z"], 0);
          const count = Math.max(40, Math.ceil(Math.abs(v[3]) * 72));
          const samples = [];
          for (let i = 0; i <= count; i++) {
            const t = i / count, a = t * v[3] * Math.PI * 2 - Math.PI / 2;
            samples.push(point3(v[0] + v[2] * t * Math.cos(a), v[1] + v[2] * t * Math.sin(a), z));
          }
          await this.animate({ type: "curve", samples, style }, secs(1.5));
          return true;
        }

        case "plot": case "function": {
          if (!args.length) throw new Error('plot requires "expression" xmin xmax');
          const expression = stripQuotes(args[0]);
          const tail = leadingNums(args.slice(1));
          const pv = tail.nums;
          if (pv.length < 2) throw new Error('plot requires "expression" xmin xmax');
          let fn;
          try { fn = compileExpression(expression); }
          catch (err) { throw new Error("plot: " + (err && err.message ? err.message : String(err))); }
          const xmin = pv[0], xmax = pv[1];
          if (!(xmax > xmin)) throw new Error("plot requires xmax > xmin");
          const span = xmax - xmin;
          const sx = pv[4] != null ? pv[4] : 600 / span;
          const sy = pv[5] != null ? pv[5] : sx;
          const ox = pv[2] != null ? pv[2] : 400 - ((xmin + xmax) / 2) * sx;
          const oy = pv[3] != null ? pv[3] : 300;
          const z = optNum(tail.rest, ["z"], 0);
          const SAMPLES = 400;
          const segments = [];
          let current = [];
          let previousY = null;
          for (let i = 0; i <= SAMPLES; i++) {
            const x = xmin + (span * i) / SAMPLES;
            const y = fn(x);
            const screenY = oy - y * sy;
            const visible = Number.isFinite(y) && Math.abs(y * sy) < 4000;
            if (!visible) {
              if (current.length > 1) segments.push(current);
              current = []; previousY = null;
              continue;
            }
            if (previousY !== null && Math.abs(screenY - previousY) > 1200) {
              if (current.length > 1) segments.push(current);
              current = [];
            }
            current.push(point3(ox + x * sx, screenY, z));
            previousY = screenY;
          }
          if (current.length > 1) segments.push(current);
          if (!segments.length) throw new Error("plot: expression produced no visible points");
          style.fill = null;
          await this.addMulti(segments.map((points) => ({ points })), style, secs(1.4));
          return true;
        }

        case "axes2d": {
          if (v.length < 7) throw new Error("axes2d requires originX originY scale xmin xmax ymin ymax");
          const ox = v[0], oy = v[1], scale = v[2], xmin = v[3], xmax = v[4], ymin = v[5], ymax = v[6];
          const z = optNum(rest, ["z"], 0);
          let step = Math.max(0.0001, optNum(rest, ["step"], 1));
          while ((xmax - xmin) / step > 24 || (ymax - ymin) / step > 24) step *= 2;
          const showGrid = hasFlag(rest, "grid");
          const tickLabels = !isOff(rest, "labels");
          style.fill = null;
          const toX = (n) => ox + n * scale;
          const toY = (n) => oy - n * scale;
          const first = (min) => Math.ceil(min / step - 1e-9);
          const last = (max) => Math.floor(max / step + 1e-9);
          const fmt = (n) => String(Number(n.toFixed(4)));
          const paths = [];
          const labels = [];
          if (showGrid) {
            for (let i = first(xmin); i <= last(xmax); i++) paths.push({ points: [point3(toX(i * step), toY(ymin), z), point3(toX(i * step), toY(ymax), z)], color: "#1e293b" });
            for (let j = first(ymin); j <= last(ymax); j++) paths.push({ points: [point3(toX(xmin), toY(j * step), z), point3(toX(xmax), toY(j * step), z)], color: "#1e293b" });
          }
          paths.push({ points: [point3(toX(xmin), oy, z), point3(toX(xmax), oy, z)] });
          paths.push({ points: [point3(ox, toY(ymin), z), point3(ox, toY(ymax), z)] });
          paths.push({ points: [point3(toX(xmax) - 9, oy - 5, z), point3(toX(xmax), oy, z), point3(toX(xmax) - 9, oy + 5, z)] });
          paths.push({ points: [point3(ox - 5, toY(ymax) + 9, z), point3(ox, toY(ymax), z), point3(ox + 5, toY(ymax) + 9, z)] });
          for (let i = first(xmin); i <= last(xmax); i++) {
            if (i === 0) continue;
            const n = i * step;
            paths.push({ points: [point3(toX(n), oy - 4, z), point3(toX(n), oy + 4, z)] });
            labels.push({ x: toX(n), y: oy + 17, text: fmt(n), align: "center" });
          }
          for (let j = first(ymin); j <= last(ymax); j++) {
            if (j === 0) continue;
            const n = j * step;
            paths.push({ points: [point3(ox - 4, toY(n), z), point3(ox + 4, toY(n), z)] });
            labels.push({ x: ox - 10, y: toY(n), text: fmt(n), align: "right" });
          }
          labels.push({ x: ox - 10, y: oy + 15, text: "0", align: "right" });
          await this.addMulti(paths, style, secs(1.2));
          if (tickLabels) for (const l of labels) this.addText(l.x, l.y, z, l.text, "#94a3b8", "12px monospace", l.align);
          return true;
        }

        case "numberline": {
          if (v.length < 5) throw new Error("numberline requires x y length min max [step=1]");
          const x = v[0], y = v[1], length = v[2], min = v[3], max = v[4];
          if (!(max > min)) throw new Error("numberline requires max > min");
          let step = Math.max(0.0001, optNum(rest, ["step"], 1));
          while ((max - min) / step > 30) step *= 2;
          const z = optNum(rest, ["z"], 0);
          style.fill = null;
          const toX = (n) => x + ((n - min) / (max - min)) * length;
          const paths = [{ points: [point3(x, y, z), point3(x + length, y, z)] }];
          const labels = [];
          for (let n = Math.ceil(min / step - 1e-9); n <= Math.floor(max / step + 1e-9); n++) {
            const value = n * step;
            paths.push({ points: [point3(toX(value), y - 6, z), point3(toX(value), y + 6, z)] });
            labels.push({ x: toX(value), text: String(Number(value.toFixed(4))) });
          }
          await this.addMulti(paths, style, secs(1.0));
          for (const l of labels) this.addText(l.x, y + 22, z, l.text, style.color, "13px monospace", "center");
          return true;
        }

        case "pie": {
          if (v.length < 4) throw new Error("pie requires cx cy radius value1 value2 ...");
          const cx = v[0], cy = v[1], radius = v[2];
          const slices = v.slice(3).map((n) => Math.max(0, n));
          const total = slices.reduce((sum, n) => sum + n, 0);
          if (total <= 0) throw new Error("pie requires at least one positive value");
          const z = optNum(rest, ["z"], 0);
          const showLabels = !isOff(rest, "labels");
          style.fill = null;
          const paths = [];
          const spots = [];
          let angle = optNum(rest, ["start"], -90) * DEG;
          slices.forEach((value, i) => {
            if (value <= 0) return;
            const sweep = (value / total) * Math.PI * 2;
            const steps = Math.max(4, Math.ceil((sweep / (Math.PI * 2)) * 72));
            const color = PALETTE[i % PALETTE.length];
            const points = [point3(cx, cy, z)];
            for (let sIdx = 0; sIdx <= steps; sIdx++) {
              const a = angle + (sweep * sIdx) / steps;
              points.push(point3(cx + radius * Math.cos(a), cy + radius * Math.sin(a), z));
            }
            paths.push({ points, closed: true, fill: withAlpha(color, 0.38), color });
            const mid = angle + sweep / 2;
            spots.push({ x: cx + radius * 0.62 * Math.cos(mid), y: cy + radius * 0.62 * Math.sin(mid), text: Math.round((value / total) * 100) + "%" });
            angle += sweep;
          });
          await this.addMulti(paths, style, secs(1.3));
          if (showLabels) for (const sp of spots) this.addText(sp.x, sp.y, z, sp.text, "#ffffff", "600 15px sans-serif", "center");
          return true;
        }

        case "bars": {
          if (v.length < 5) throw new Error("bars requires x y barWidth maxHeight value1 value2 ...");
          const x = v[0], y = v[1], barWidth = v[2], maxHeight = v[3];
          const data = v.slice(4);
          const peak = Math.max.apply(null, data.map((n) => Math.abs(n)).concat([1e-9]));
          const gap = optNum(rest, ["gap"], barWidth * 0.35);
          const z = optNum(rest, ["z"], 0);
          const showValues = !isOff(rest, "values");
          const customFill = style.fill;
          style.fill = null;
          const paths = [];
          const tops = [];
          const totalWidth = data.length * barWidth + (data.length - 1) * gap;
          paths.push({ points: [point3(x - 8, y, z), point3(x + totalWidth + 8, y, z)], color: "#64748b" });
          data.forEach((value, i) => {
            const height = (value / peak) * maxHeight;
            const left = x + i * (barWidth + gap);
            const color = customFill ? style.color : PALETTE[i % PALETTE.length];
            paths.push({
              points: [point3(left, y, z), point3(left, y - height, z), point3(left + barWidth, y - height, z), point3(left + barWidth, y, z)],
              closed: true, fill: customFill || withAlpha(color, 0.38), color
            });
            tops.push({ x: left + barWidth / 2, y: y - height - (value >= 0 ? 14 : -14), text: String(Number(value.toFixed(4))) });
          });
          await this.addMulti(paths, style, secs(1.2));
          if (showValues) for (const t of tops) this.addText(t.x, t.y, z, t.text, "#e2e8f0", "600 14px monospace", "center");
          return true;
        }

        case "angle": {
          if (v.length < 5) throw new Error('angle requires cx cy radius startDeg endDeg ["label"]');
          const cx = v[0], cy = v[1], radius = v[2], startDeg = v[3], endDeg = v[4];
          const z = optNum(rest, ["z"], 0);
          style.fill = null;
          const label = labelOf(rest);
          const toPoint = (deg, r) => point3(cx + r * Math.cos(-deg * DEG), cy + r * Math.sin(-deg * DEG), z);
          const paths = [];
          if (hasFlag(rest, "rays")) {
            paths.push({ points: [point3(cx, cy, z), toPoint(startDeg, radius * 1.45)] });
            paths.push({ points: [point3(cx, cy, z), toPoint(endDeg, radius * 1.45)] });
          }
          if (hasFlag(rest, "square")) {
            const size = radius * 0.6;
            const a = toPoint(startDeg, size), b = toPoint(endDeg, size);
            paths.push({ points: [a, point3(a.x + (b.x - cx), a.y + (b.y - cy), z), b] });
          } else {
            const steps = Math.max(8, Math.ceil(Math.abs(endDeg - startDeg) / 3));
            const arcPoints = [];
            for (let i = 0; i <= steps; i++) arcPoints.push(toPoint(startDeg + ((endDeg - startDeg) * i) / steps, radius));
            paths.push({ points: arcPoints });
          }
          await this.addMulti(paths, style, secs(0.7));
          if (label) {
            const spot = toPoint((startDeg + endDeg) / 2, radius * 1.4);
            this.addText(spot.x, spot.y, z, label, style.color, "600 16px sans-serif", "center");
          }
          return true;
        }

        case "dimension": {
          if (v.length < 4) throw new Error('dimension requires x1 y1 x2 y2 "label" [offset=24]');
          const x1 = v[0], y1 = v[1], x2 = v[2], y2 = v[3];
          const z = optNum(rest, ["z"], 0);
          const offset = optNum(rest, ["offset"], 24);
          const label = labelOf(rest);
          style.fill = null;
          const len = Math.hypot(x2 - x1, y2 - y1) || 1;
          const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
          const nx = -uy, ny = ux;
          const side = offset >= 0 ? 1 : -1;
          const ax = x1 + nx * offset, ay = y1 + ny * offset, bx = x2 + nx * offset, by = y2 + ny * offset;
          const head = 9;
          const chevron = (tx, ty, dx, dy) => {
            const rot = (a) => [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)];
            const l = rot(0.45), r = rot(-0.45);
            return [point3(tx - l[0] * head, ty - l[1] * head, z), point3(tx, ty, z), point3(tx - r[0] * head, ty - r[1] * head, z)];
          };
          const paths = [
            { points: [point3(x1, y1, z), point3(x1 + nx * (offset + 6 * side), y1 + ny * (offset + 6 * side), z)] },
            { points: [point3(x2, y2, z), point3(x2 + nx * (offset + 6 * side), y2 + ny * (offset + 6 * side), z)] },
            { points: [point3(ax, ay, z), point3(bx, by, z)] },
            { points: chevron(bx, by, ux, uy) },
            { points: chevron(ax, ay, -ux, -uy) }
          ];
          await this.addMulti(paths, style, secs(0.8));
          if (label) this.addText((ax + bx) / 2 + nx * 14 * side, (ay + by) / 2 + ny * 14 * side, z, label, style.color, "600 15px sans-serif", "center");
          return true;
        }

        case "background": {
          const color = args.map(stripQuotes).find(isColor) || optStr(args, ["color"]);
          if (!color) throw new Error("background requires a color, e.g. background #0f172a");
          this.bg = color;
          this.render();
          return true;
        }

        case "camera": {
          const to = {};
          for (const token of args) {
            const lower = String(token).toLowerCase();
            if (lower === "iso") { to.yaw = -0.58; to.pitch = 0.36; to.roll = 0; }
            else if (lower === "front" || lower === "reset") {
              to.yaw = 0; to.pitch = 0; to.roll = 0;
              if (lower === "reset") to.zoom = 0.72;
            }
          }
          const yaw = optStr(args, ["yaw"]), pitch = optStr(args, ["pitch"]), roll = optStr(args, ["roll"]), zoom = optStr(args, ["zoom"]);
          if (yaw != null) to.yaw = toNum(yaw) * DEG;
          if (pitch != null) to.pitch = clamp(toNum(pitch) * DEG, -Math.PI / 2 + 0.03, Math.PI / 2 - 0.03);
          if (roll != null) to.roll = toNum(roll) * DEG;
          // `zoom=` is relative to the default view, like the Studio canvas (1 = default).
          if (zoom != null) to.zoom = clamp(toNum(zoom, 1) * 0.72, 0.1, 10);
          if (!Object.keys(to).length) throw new Error("camera requires iso | front | reset | yaw=deg pitch=deg zoom=n");
          await this.animateCamera(to, optNum(args, ["duration"], 0.9));
          return true;
        }

        default:
          return false;
      }
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
      if (await this.execExtra(name, args, style)) return;
      if (name === "line" || name === "arrow" || name === "doublearrow") {
        const pts = nums.length >= 6
          ? [point3(nums[0], nums[1], nums[2]), point3(nums[3], nums[4], nums[5])]
          : [point3(nums[0] || 0, nums[1] || 0, 0), point3(nums[2] || 100, nums[3] || 100, 0)];
        await this.animate({ type: "line", points: pts, style, arrow: name !== "line", arrowStart: name === "doublearrow", head: 12 }, 0.7 / style.speed);
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
      this.bg = "#030712";
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
