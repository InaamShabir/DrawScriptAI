export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface CameraState {
  yaw: number;
  pitch: number;
  roll: number;
  zoom: number;
  target: Point3;
}

export interface DrawStyle {
  color: string;
  speed: number;
  width: number;
  glow: number;
  glowColor: string;
  opacity: number;
  fill: string | null;
  dash: number[];
  cap: CanvasLineCap;
  join: CanvasLineJoin;
  duration: number | null;
  ease: string;
}

export interface ScriptPart {
  id: number;
  type: 'speech' | 'draw';
  text?: string;
  command?: string;
}

export type EnginePlaybackState = 'idle' | 'playing' | 'paused' | 'stopped' | 'finished' | 'error';

export interface EngineSnapshot {
  playback: EnginePlaybackState;
  activePartIndex: number;
  totalParts: number;
  caption: string;
  statusMessage: string;
  errorMessage: string | null;
  camera: {
    yawDeg: number;
    pitchDeg: number;
    zoom: number;
  };
  objectCount: number;
}

const COLORS =
  /^(red|green|blue|yellow|orange|purple|pink|white|black|cyan|magenta|lime|gold|gray|grey|brown|navy|teal|aqua|maroon|silver)$/i;

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toNum(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function stripQuotes(value: string): string {
  if (value.length >= 2) {
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      return value.slice(1, -1);
    }
  }
  return value;
}

function isNumberToken(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  return Number.isFinite(Number(value));
}

function point3(x: number, y: number, z = 0): Point3 {
  return { x: toNum(x), y: toNum(y), z: toNum(z) };
}

function tokenize(command: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: string | null = null;
  let escaped = false;

  for (const ch of String(command).trim()) {
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      current += ch;
      continue;
    }
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += ch;
  }

  if (current) tokens.push(current);
  return tokens;
}

function parseCommand(raw: string): { name: string; args: string[] } | null {
  const tokens = tokenize(raw);
  if (!tokens.length) return null;
  return {
    name: tokens[0].toLowerCase(),
    args: tokens.slice(1),
  };
}

function isColor(value: string): boolean {
  return (
    COLORS.test(value) ||
    /^#[0-9a-f]{3,8}$/i.test(value) ||
    /^(rgb|rgba|hsl|hsla)\(/i.test(value)
  );
}

function isSpeed(value: string): boolean {
  return /^\d+(?:\.\d+)?x$/i.test(String(value));
}

function isFont(value: string): boolean {
  return /^\d+(?:\.\d+)?(?:px|pt|em|rem|%|vw|vh)(?:\s+.+)?$/i.test(String(value));
}

function parseDuration(value: string | null | undefined, fallback = 1): number {
  if (value == null) return fallback;
  const s = String(value).trim().toLowerCase();
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return fallback;
  if (s.endsWith('ms')) return n / 1000;
  return n;
}

function createStyle(args: string[]): DrawStyle {
  let color = '#ffffff';
  let speed = 1;
  let width = 4;
  let glow = 0;
  let glowColor: string | null = null;
  let opacity = 1;
  let fill: string | null = null;
  let dash: number[] = [];
  let cap: CanvasLineCap = 'round';
  let join: CanvasLineJoin = 'round';
  let duration: number | null = null;
  let ease = 'linear';

  for (const rawToken of args) {
    const token = String(rawToken);
    if (isColor(token)) {
      color = token;
      continue;
    }
    if (isSpeed(token)) {
      speed = Math.max(0.05, toNum(token.slice(0, -1), 1));
      continue;
    }
    if (token.startsWith('color=')) {
      color = stripQuotes(token.slice(6));
      continue;
    }
    if (token.startsWith('width=')) {
      width = toNum(token.slice(6), 4);
      continue;
    }
    if (token.startsWith('w=')) {
      width = toNum(token.slice(2), 4);
      continue;
    }
    if (token.startsWith('glow=')) {
      glow = toNum(token.slice(5), 0);
      continue;
    }
    if (token.startsWith('glowcolor=')) {
      glowColor = stripQuotes(token.slice(10));
      continue;
    }
    if (token.startsWith('opacity=')) {
      opacity = clamp(toNum(token.slice(8), 1), 0, 1);
      continue;
    }
    if (token.startsWith('alpha=')) {
      opacity = clamp(toNum(token.slice(6), 1), 0, 1);
      continue;
    }
    if (token.startsWith('fill=')) {
      fill = stripQuotes(token.slice(5));
      continue;
    }
    if (token.startsWith('dash=')) {
      dash = token
        .slice(5)
        .split(',')
        .map(Number)
        .filter(Number.isFinite);
      continue;
    }
    if (token.startsWith('cap=')) {
      cap = token.slice(4) as CanvasLineCap;
      continue;
    }
    if (token.startsWith('join=')) {
      join = token.slice(5) as CanvasLineJoin;
      continue;
    }
    if (token.startsWith('duration=')) {
      duration = parseDuration(token.slice(9), 1);
      continue;
    }
    if (token.startsWith('speed=')) {
      speed = Math.max(0.05, toNum(token.slice(6), 1));
      continue;
    }
    if (token.startsWith('ease=')) {
      ease = token.slice(5);
      continue;
    }
  }

  return {
    color,
    speed,
    width,
    glow,
    glowColor: glowColor || color,
    opacity,
    fill,
    dash,
    cap,
    join,
    duration,
    ease,
  };
}

function easing(progress: number, type: string): number {
  const p = clamp(progress, 0, 1);
  if (type === 'ease') return p * p * (3 - 2 * p);
  if (type === 'in') return p * p;
  if (type === 'out') return 1 - (1 - p) * (1 - p);
  return p;
}

function animationTimeMs(style: DrawStyle, normalSeconds: number): number {
  const base = style.duration != null ? style.duration : normalSeconds;
  return Math.max(20, (base / style.speed) * 1000);
}

/**
 * Parses natural narration interspersed with \(command ...\) DrawScript blocks.
 * Also normalizes double-escaped \\( ... \\) that some LLM markdown renders emit.
 */
export function parseDrawScript(source: string): ScriptPart[] {
  const normalized = source.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
  const regex = /\\\(([\s\S]*?)\\\)/g;
  const parts: ScriptPart[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let idCounter = 0;

  while ((match = regex.exec(normalized)) !== null) {
    const speech = normalized.slice(last, match.index);
    if (speech.trim()) {
      parts.push({
        id: idCounter++,
        type: 'speech',
        text: speech.trim(),
      });
    }
    const cmd = match[1].trim();
    if (cmd) {
      parts.push({
        id: idCounter++,
        type: 'draw',
        command: cmd,
      });
    }
    last = regex.lastIndex;
  }

  const remaining = normalized.slice(last);
  if (remaining.trim()) {
    parts.push({
      id: idCounter++,
      type: 'speech',
      text: remaining.trim(),
    });
  }

  return parts;
}

/**
 * Extracts clean DrawScript text from raw ChatGPT/Claude assistant copy or HTML/Markdown.
 */
export function extractDrawScriptFromResponse(rawText: string): {
  script: string;
  commandCount: number;
  speechSegments: number;
} {
  const cleaned = rawText
    .replace(/```[a-zA-Z]*\n?/g, '')
    .replace(/```/g, '')
    .replace(/\\\\\(/g, '\\(')
    .replace(/\\\\\)/g, '\\)')
    .trim();

  const parts = parseDrawScript(cleaned);
  const commandCount = parts.filter((p) => p.type === 'draw').length;
  const speechSegments = parts.filter((p) => p.type === 'speech').length;
  return { script: cleaned, commandCount, speechSegments };
}

interface SceneObject {
  type: string;
  progress: number;
  points?: Point3[];
  samples?: Point3[];
  center?: Point3;
  position?: Point3;
  closed?: boolean;
  style?: DrawStyle;
  radius?: number;
  rx?: number;
  ry?: number;
  start?: number;
  end?: number;
  plane?: string;
  arrow?: boolean;
  head?: number;
  height?: number;
  width?: number;
  x?: number;
  y?: number;
  z?: number;
  cell?: number;
  rows?: number;
  cols?: number;
  text?: string;
  color?: string;
  font?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  glow?: number;
  opacity?: number;
  image?: HTMLImageElement;
  geometry?: any;
  geometryPoints?: Point3[];
}

export class DrawScriptEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width = 800;
  private height = 600;
  private dpr = 1;
  private scene: SceneObject[] = [];
  private camera: CameraState;
  private stopped = false;
  private instantMode = false;
  private speechEnabled = true;
  private speedMultiplier = 1;
  private playback: EnginePlaybackState = 'idle';
  private activePartIndex = -1;
  private totalParts = 0;
  private caption = '';
  private statusMessage = 'Ready · 3D orthographic world';
  private errorMessage: string | null = null;
  private onUpdate?: (snapshot: EngineSnapshot) => void;
  private lastOrbitUiUpdate = 0;

  private readonly MIN_ZOOM = 0.05;
  private readonly MAX_ZOOM = 20;
  private readonly MIN_PITCH = -Math.PI / 2 + 0.03;
  private readonly MAX_PITCH = Math.PI / 2 - 0.03;

  constructor(canvas: HTMLCanvasElement, onUpdate?: (snapshot: EngineSnapshot) => void) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Could not initialize 2D canvas context');
    }
    this.ctx = context;
    this.onUpdate = onUpdate;

    this.width = canvas.clientWidth || 800;
    this.height = canvas.clientHeight || 600;
    this.camera = {
      yaw: 0,
      pitch: 0,
      roll: 0,
      zoom: 1,
      target: { x: 400, y: 300, z: 0 },
    };

    this.resize();
  }

  public setOnUpdate(cb: (snapshot: EngineSnapshot) => void) {
    this.onUpdate = cb;
    this.emitUpdate();
  }

  public setSpeechEnabled(enabled: boolean) {
    this.speechEnabled = enabled;
    if (!enabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public setSpeedMultiplier(mult: number) {
    this.speedMultiplier = clamp(mult, 0.25, 4);
  }

  public getSnapshot(): EngineSnapshot {
    return {
      playback: this.playback,
      activePartIndex: this.activePartIndex,
      totalParts: this.totalParts,
      caption: this.caption,
      statusMessage: this.statusMessage,
      errorMessage: this.errorMessage,
      camera: {
        yawDeg: Number(((this.camera.yaw * 180) / Math.PI).toFixed(1)),
        pitchDeg: Number(((this.camera.pitch * 180) / Math.PI).toFixed(1)),
        zoom: Number(this.camera.zoom.toFixed(2)),
      },
      objectCount: this.scene.length,
    };
  }

  private emitUpdate() {
    if (this.onUpdate) {
      this.onUpdate(this.getSnapshot());
    }
  }

  public resize() {
    const rect = this.canvas.getBoundingClientRect();
    const newWidth = Math.max(300, rect.width || this.canvas.clientWidth || 800);
    const newHeight = Math.max(240, rect.height || this.canvas.clientHeight || 600);
    const oldWidth = this.width;
    const oldHeight = this.height;

    this.width = newWidth;
    this.height = newHeight;
    this.dpr = Math.max(1, window.devicePixelRatio || 1);

    this.canvas.width = Math.round(this.width * this.dpr);
    this.canvas.height = Math.round(this.height * this.dpr);

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    if (oldWidth && oldHeight) {
      this.camera.target.x += (newWidth - oldWidth) / 2;
      this.camera.target.y += (newHeight - oldHeight) / 2;
    }

    this.renderScene();
  }

  public resetCamera(centerWorld?: Point3) {
    this.camera.yaw = 0;
    this.camera.pitch = 0;
    this.camera.roll = 0;
    this.camera.zoom = 1;
    this.camera.target = centerWorld
      ? { ...centerWorld }
      : { x: 400, y: 300, z: 0 };
    this.statusMessage = 'Camera reset';
    this.renderScene();
    this.emitUpdate();
  }

  public orbitBy(dx: number, dy: number) {
    const ORBIT_SENSITIVITY = 0.008;
    this.camera.yaw -= dx * ORBIT_SENSITIVITY;
    this.camera.pitch = clamp(
      this.camera.pitch - dy * ORBIT_SENSITIVITY,
      this.MIN_PITCH,
      this.MAX_PITCH
    );
    this.renderScene();
    // Keep React's HUD updates below the render rate while preserving full-rate canvas redraws.
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastOrbitUiUpdate >= 100) {
      this.lastOrbitUiUpdate = now;
      this.emitUpdate();
    }
  }

  public syncSnapshot() {
    this.lastOrbitUiUpdate = typeof performance !== 'undefined' ? performance.now() : Date.now();
    this.emitUpdate();
  }

  public panBy(dx: number, dy: number) {
    const cos = Math.cos(this.camera.roll);
    const sin = Math.sin(this.camera.roll);
    const worldDX = (dx * cos + dy * sin) / this.camera.zoom;
    const worldDY = (-dx * sin + dy * cos) / this.camera.zoom;
    this.camera.target.x -= worldDX;
    this.camera.target.y -= worldDY;
    this.renderScene();
    this.emitUpdate();
  }

  public zoomByFactor(factor: number) {
    this.camera.zoom = clamp(this.camera.zoom * factor, this.MIN_ZOOM, this.MAX_ZOOM);
    this.renderScene();
    this.emitUpdate();
  }

  public setIsoPreset() {
    this.camera.yaw = -0.58;
    this.camera.pitch = 0.36;
    this.camera.roll = 0;
    this.renderScene();
    this.emitUpdate();
  }

  public clear() {
    this.scene.length = 0;
    this.caption = '';
    this.errorMessage = null;
    this.renderScene();
    this.emitUpdate();
  }

  public stop() {
    this.stopped = true;
    this.playback = 'stopped';
    this.statusMessage = 'Playback stopped';
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.emitUpdate();
  }

  public async play(source: string, options?: { instant?: boolean }) {
    this.stop();
    await this.sleep(10);

    this.stopped = false;
    this.instantMode = Boolean(options?.instant);
    this.errorMessage = null;
    this.playback = 'playing';
    this.clear();

    // Auto-center camera target to standard 800x600 DrawScript drafting coordinate space
    this.camera.target = { x: 400, y: 300, z: 0 };

    const parts = parseDrawScript(source);
    this.totalParts = parts.length;
    this.activePartIndex = -1;
    this.statusMessage = this.instantMode ? 'Rendering diagram' : 'Playing lesson';
    this.emitUpdate();

    for (let i = 0; i < parts.length; i++) {
      if (this.stopped) break;
      const part = parts[i];
      this.activePartIndex = i;

      if (part.type === 'speech' && part.text) {
        this.caption = part.text.replace(/\s+/g, ' ').trim();
        this.statusMessage = 'Narrating step';
        this.emitUpdate();
        if (!this.instantMode && this.speechEnabled) {
          await this.speak(this.caption);
        }
        continue;
      }

      if (part.type === 'draw' && part.command) {
        this.statusMessage = `Drawing: ${part.command}`;
        this.emitUpdate();

        try {
          if (this.instantMode) {
            await this.executeCommand(part.command);
          } else {
            const drawPromise = this.executeCommand(part.command);
            const beatMs = Math.max(250, 900 / this.speedMultiplier);
            await Promise.all([drawPromise, this.sleep(beatMs)]);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          this.errorMessage = msg;
          this.statusMessage = `Command warning: ${msg}`;
          this.emitUpdate();
        }
      }
    }

    if (!this.stopped) {
      this.playback = 'finished';
      this.statusMessage = `Finished · ${this.scene.length} 3D objects`;
    }
    this.emitUpdate();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private speak(text: string): Promise<void> {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (!clean || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(clean);
        utterance.rate = clamp(this.speedMultiplier, 0.75, 2);
        utterance.pitch = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        window.speechSynthesis.speak(utterance);
      } catch {
        resolve();
      }
    });
  }

  private applyStyle(style: DrawStyle) {
    this.ctx.strokeStyle = style.color;
    this.ctx.fillStyle = style.fill || style.color;
    this.ctx.globalAlpha = style.opacity;
    this.ctx.lineWidth = Math.max(0.5, style.width * this.camera.zoom);
    this.ctx.lineCap = style.cap;
    this.ctx.lineJoin = style.join;
    this.ctx.setLineDash(style.dash.map((v) => v * this.camera.zoom));
    this.ctx.shadowBlur = style.glow * this.camera.zoom;
    this.ctx.shadowColor = style.glowColor;
  }

  private resetStyle() {
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;
    this.ctx.shadowColor = 'transparent';
    this.ctx.setLineDash([]);
  }

  private worldToCamera(p: Point3): Point3 {
    const dx = p.x - this.camera.target.x;
    const dy = p.y - this.camera.target.y;
    const dz = p.z - this.camera.target.z;

    const cy = Math.cos(this.camera.yaw);
    const sy = Math.sin(this.camera.yaw);
    const x1 = cy * dx - sy * dz;
    const z1 = sy * dx + cy * dz;

    const cp = Math.cos(this.camera.pitch);
    const sp = Math.sin(this.camera.pitch);
    const y2 = cp * dy - sp * z1;
    const z2 = sp * dy + cp * z1;

    const cr = Math.cos(this.camera.roll);
    const sr = Math.sin(this.camera.roll);
    const x3 = cr * x1 - sr * y2;
    const y3 = sr * x1 + cr * y2;

    return { x: x3, y: y3, z: z2 };
  }

  private project(p: Point3): { x: number; y: number; depth: number } {
    const c = this.worldToCamera(p);
    return {
      x: this.width / 2 + c.x * this.camera.zoom,
      y: this.height / 2 + c.y * this.camera.zoom,
      depth: c.z,
    };
  }

  private projectedPoints(points: Point3[]) {
    return points.map((p) => this.project(p));
  }

  private objectDepth(obj: SceneObject): number {
    if ((obj.type === 'point' || obj.type === 'text' || obj.type === 'image') && obj.position) {
      return this.project(obj.position).depth;
    }
    if (obj.points && obj.points.length) {
      let total = 0;
      for (const p of obj.points) total += this.project(p).depth;
      return total / obj.points.length;
    }
    if (obj.samples && obj.samples.length) {
      let total = 0;
      for (const p of obj.samples) total += this.project(p).depth;
      return total / obj.samples.length;
    }
    if ((obj.type === 'cylinder' || obj.type === 'cone') && obj.geometryPoints?.length) {
      let total = 0;
      for (const p of obj.geometryPoints) total += this.project(p).depth;
      return total / obj.geometryPoints.length;
    }
    if (obj.center) {
      return this.project(obj.center).depth;
    }
    return 0;
  }

  public renderScene() {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.width, this.height);

    // Subtle 3D drafting background
    this.ctx.fillStyle = '#030712';
    this.ctx.fillRect(0, 0, this.width, this.height);

    const sorted = this.scene.slice().sort((a, b) => this.objectDepth(a) - this.objectDepth(b));
    for (const obj of sorted) {
      this.renderObject(obj);
    }
    this.resetStyle();
  }

  private drawProjectedPath(
    points: Point3[],
    progress: number,
    closed: boolean,
    style: DrawStyle
  ) {
    if (points.length < 2) return;
    const projected = this.projectedPoints(points);
    const segments = points.length - 1;
    const position = clamp(progress, 0, 1) * segments;
    const whole = Math.floor(position);
    const fraction = position - whole;

    this.ctx.beginPath();
    this.ctx.moveTo(projected[0].x, projected[0].y);

    for (let i = 1; i <= whole && i < projected.length; i++) {
      this.ctx.lineTo(projected[i].x, projected[i].y);
    }

    if (whole < segments) {
      const a = projected[whole];
      const b = projected[whole + 1];
      this.ctx.lineTo(a.x + (b.x - a.x) * fraction, a.y + (b.y - a.y) * fraction);
    }

    if (closed && progress >= 1) {
      this.ctx.closePath();
    }

    this.applyStyle(style);
    this.ctx.stroke();

    if (closed && style.fill && progress >= 1) {
      this.ctx.fill();
    }
    this.resetStyle();
  }

  private ellipseSamples(
    center: Point3,
    rx: number,
    ry: number,
    plane: string,
    start: number,
    end: number,
    count: number
  ): Point3[] {
    const pts: Point3[] = [];
    for (let i = 0; i <= count; i++) {
      const t = start + (end - start) * (i / count);
      const c = Math.cos(t);
      const s = Math.sin(t);

      if (plane === 'xz') {
        pts.push({ x: center.x + rx * c, y: center.y, z: center.z + ry * s });
      } else if (plane === 'yz') {
        pts.push({ x: center.x, y: center.y + rx * c, z: center.z + ry * s });
      } else {
        pts.push({ x: center.x + rx * c, y: center.y + ry * s, z: center.z });
      }
    }
    return pts;
  }

  private scaleFont(font: string): string {
    return String(font).replace(/(\d+(?:\.\d+)?)px/g, (_m, value) => `${Number(value) * this.camera.zoom}px`);
  }

  private renderObject(object: SceneObject) {
    const progress = object.progress == null ? 1 : object.progress;

    if (object.type === 'line' && object.points && object.style) {
      this.drawProjectedPath(object.points, progress, false, object.style);
      if (object.arrow && progress >= 1 && object.points.length >= 2) {
        const p = this.project(object.points[1]);
        const q = this.project(object.points[0]);
        const angle = Math.atan2(p.y - q.y, p.x - q.x);
        const head = (object.head ?? 12) * this.camera.zoom;

        this.ctx.save();
        this.applyStyle(object.style);
        this.ctx.beginPath();
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x - head * Math.cos(angle - 0.55), p.y - head * Math.sin(angle - 0.55));
        this.ctx.moveTo(p.x, p.y);
        this.ctx.lineTo(p.x - head * Math.cos(angle + 0.55), p.y - head * Math.sin(angle + 0.55));
        this.ctx.stroke();
        this.ctx.restore();
      }
      return;
    }

    if (object.type === 'path' && object.points && object.style) {
      this.drawProjectedPath(object.points, progress, Boolean(object.closed), object.style);
      return;
    }

    if (object.type === 'point' && object.position && object.style) {
      const p = this.project(object.position);
      this.applyStyle(object.style);
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, Math.max(0.5, (object.radius ?? 6) * progress * this.camera.zoom), 0, Math.PI * 2);
      this.ctx.fill();
      this.resetStyle();
      return;
    }

    if (object.type === 'curve' && object.samples && object.style) {
      this.drawProjectedPath(object.samples, progress, false, object.style);
      return;
    }

    if (
      (object.type === 'circle' || object.type === 'ellipse' || object.type === 'arc') &&
      object.center &&
      object.style
    ) {
      const start = object.start ?? 0;
      const end = start + ((object.end ?? Math.PI * 2) - start) * progress;
      const pts = this.ellipseSamples(
        object.center,
        object.rx ?? 40,
        object.ry ?? 40,
        object.plane ?? 'xy',
        start,
        end,
        120
      );
      this.drawProjectedPath(pts, 1, Boolean(object.closed), object.style);
      return;
    }

    if (object.type === 'cylinder' && object.geometry && object.style) {
      const geometry = object.geometry;
      const visible = Math.max(1, Math.ceil(geometry.sideFaces.length * progress));
      for (let i = 0; i < visible && i < geometry.sideFaces.length; i++) {
        const projected = this.projectedPoints(geometry.sideFaces[i]);
        if (projected.length < 4) continue;
        this.ctx.beginPath();
        this.ctx.moveTo(projected[0].x, projected[0].y);
        this.ctx.lineTo(projected[1].x, projected[1].y);
        this.ctx.lineTo(projected[2].x, projected[2].y);
        this.ctx.lineTo(projected[3].x, projected[3].y);
        this.ctx.closePath();
        this.applyStyle(object.style);
        if (object.style.fill) this.ctx.fill();
        this.ctx.stroke();
        this.resetStyle();
      }
      if (progress >= 1) {
        this.drawProjectedPath([...geometry.bottom, geometry.bottom[0]], 1, false, object.style);
        this.drawProjectedPath([...geometry.top, geometry.top[0]], 1, false, object.style);
        if (object.style.fill) {
          const bProj = this.projectedPoints(geometry.bottom);
          const tProj = this.projectedPoints(geometry.top);
          this.ctx.save();
          this.applyStyle(object.style);
          this.ctx.beginPath();
          this.ctx.moveTo(bProj[0].x, bProj[0].y);
          for (let i = 1; i < bProj.length; i++) this.ctx.lineTo(bProj[i].x, bProj[i].y);
          this.ctx.closePath();
          this.ctx.fill();

          this.ctx.beginPath();
          this.ctx.moveTo(tProj[0].x, tProj[0].y);
          for (let i = 1; i < tProj.length; i++) this.ctx.lineTo(tProj[i].x, tProj[i].y);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.restore();
        }
      }
      return;
    }

    if (object.type === 'cone' && object.geometry && object.style) {
      const geometry = object.geometry;
      const visible = Math.max(1, Math.ceil(geometry.sideFaces.length * progress));
      for (let i = 0; i < visible && i < geometry.sideFaces.length; i++) {
        const projected = this.projectedPoints(geometry.sideFaces[i]);
        this.ctx.beginPath();
        this.ctx.moveTo(projected[0].x, projected[0].y);
        this.ctx.lineTo(projected[1].x, projected[1].y);
        this.ctx.lineTo(projected[2].x, projected[2].y);
        this.ctx.closePath();
        this.applyStyle(object.style);
        if (object.style.fill) this.ctx.fill();
        this.ctx.stroke();
        this.resetStyle();
      }
      if (progress >= 1) {
        this.drawProjectedPath([...geometry.base, geometry.base[0]], 1, false, object.style);
        if (object.style.fill) {
          const bProj = this.projectedPoints(geometry.base);
          this.ctx.save();
          this.applyStyle(object.style);
          this.ctx.beginPath();
          this.ctx.moveTo(bProj[0].x, bProj[0].y);
          for (let i = 1; i < bProj.length; i++) this.ctx.lineTo(bProj[i].x, bProj[i].y);
          this.ctx.closePath();
          this.ctx.fill();
          this.ctx.restore();
        }
      }
      return;
    }

    if (object.type === 'text' && object.position) {
      const p = this.project(object.position);
      this.ctx.save();
      this.ctx.globalAlpha = (object.opacity ?? 1) * progress;
      this.ctx.fillStyle = object.color ?? '#fff';
      this.ctx.font = this.scaleFont(object.font ?? '24px sans-serif');
      this.ctx.textAlign = object.align ?? 'left';
      this.ctx.textBaseline = object.baseline ?? 'alphabetic';
      this.ctx.shadowBlur = (object.glow ?? 0) * this.camera.zoom;
      this.ctx.shadowColor = object.color ?? '#fff';
      this.ctx.fillText(object.text ?? '', p.x, p.y);
      this.ctx.restore();
      return;
    }

    if (object.type === 'highlight' && object.center && object.style) {
      const p = this.project(object.center);
      this.ctx.save();
      this.ctx.globalAlpha = object.style.opacity * 0.35 * progress;
      this.ctx.strokeStyle = object.style.color;
      this.ctx.lineWidth = object.style.width * this.camera.zoom;
      this.ctx.shadowBlur = object.style.glow * this.camera.zoom;
      this.ctx.shadowColor = object.style.glowColor;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, (object.radius ?? 30) * this.camera.zoom, 0, Math.PI * 2);
      this.ctx.stroke();
      this.ctx.restore();
      return;
    }

    if (object.type === 'cross' && object.center && object.style) {
      const r = (object.radius ?? 14) * progress;
      this.drawProjectedPath(
        [
          { x: object.center.x - r, y: object.center.y, z: object.center.z },
          { x: object.center.x + r, y: object.center.y, z: object.center.z },
        ],
        1,
        false,
        object.style
      );
      this.drawProjectedPath(
        [
          { x: object.center.x, y: object.center.y - r, z: object.center.z },
          { x: object.center.x, y: object.center.y + r, z: object.center.z },
        ],
        1,
        false,
        object.style
      );
      return;
    }

    if (object.type === 'bracket' && object.style) {
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const z = object.z ?? 0;
      const w = (object.width ?? 20) * progress;
      const h = object.height ?? 60;
      this.drawProjectedPath(
        [
          { x, y, z },
          { x: x + w, y, z },
          { x: x + w, y: y + h, z },
          { x, y: y + h, z },
        ],
        1,
        false,
        object.style
      );
      return;
    }

    if (object.type === 'grid' && object.style) {
      const x = object.x ?? 0;
      const y = object.y ?? 0;
      const z = object.z ?? 0;
      const cell = object.cell ?? 40;
      const rows = object.rows ?? 5;
      const cols = object.cols ?? 5;
      const lines: Point3[][] = [];
      for (let i = 0; i <= cols; i++) {
        lines.push([
          { x: x + i * cell, y, z },
          { x: x + i * cell, y: y + rows * cell, z },
        ]);
      }
      for (let j = 0; j <= rows; j++) {
        lines.push([
          { x, y: y + j * cell, z },
          { x: x + cols * cell, y: y + j * cell, z },
        ]);
      }
      const count = Math.ceil(lines.length * progress);
      for (let i = 0; i < count; i++) {
        this.drawProjectedPath(lines[i], 1, false, object.style);
      }
      return;
    }

    if (object.type === 'image' && object.image && object.position) {
      const p = this.project(object.position);
      this.ctx.save();
      this.ctx.globalAlpha = (object.opacity ?? 1) * progress;
      const w = (object.width ?? 100) * this.camera.zoom;
      const h = (object.height ?? 100) * this.camera.zoom;
      this.ctx.drawImage(object.image, p.x - w / 2, p.y - h / 2, w, h);
      this.ctx.restore();
    }
  }

  private addAnimatedObject(object: SceneObject, seconds: number, ease = 'linear'): Promise<void> {
    if (this.instantMode) {
      object.progress = 1;
      this.scene.push(object);
      this.renderScene();
      return Promise.resolve();
    }

    object.progress = 0;
    this.scene.push(object);
    this.renderScene();

    const milliseconds = Math.max(20, (seconds * 1000) / this.speedMultiplier);
    const start = performance.now();

    return new Promise((resolve) => {
      const frame = (now: number) => {
        if (this.stopped) {
          object.progress = 1;
          this.renderScene();
          resolve();
          return;
        }
        const raw = clamp((now - start) / milliseconds, 0, 1);
        object.progress = easing(raw, ease);
        this.renderScene();
        if (raw < 1) {
          requestAnimationFrame(frame);
        } else {
          object.progress = 1;
          this.renderScene();
          resolve();
        }
      };
      requestAnimationFrame(frame);
    });
  }

  private cylinderGeometry(center: Point3, radius: number, height: number, segments = 60) {
    const bottom: Point3[] = [];
    const top: Point3[] = [];
    const sideFaces: Point3[][] = [];

    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const x = center.x + radius * Math.cos(t);
      const z = center.z + radius * Math.sin(t);
      bottom.push(point3(x, center.y, z));
      top.push(point3(x, center.y - height, z));
    }
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      sideFaces.push([bottom[i], bottom[next], top[next], top[i]]);
    }
    return { bottom, top, sideFaces };
  }

  private coneGeometry(center: Point3, radius: number, height: number, segments = 60) {
    const base: Point3[] = [];
    const sideFaces: Point3[][] = [];
    const apex = point3(center.x, center.y - height, center.z);

    for (let i = 0; i < segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      base.push(point3(center.x + radius * Math.cos(t), center.y, center.z + radius * Math.sin(t)));
    }
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments;
      sideFaces.push([base[i], base[next], apex]);
    }
    return { base, apex, sideFaces };
  }

  private splitGeometryAndStyle(args: string[]) {
    const geometry: number[] = [];
    let index = 0;
    while (index < args.length && isNumberToken(args[index])) {
      geometry.push(toNum(args[index]));
      index++;
    }
    return { geometry, styles: args.slice(index) };
  }

  public async executeCommand(command: string) {
    const parsed = parseCommand(command);
    if (!parsed) return;
    const args = parsed.args;

    switch (parsed.name) {
      case 'point':
      case 'dot': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 2) throw new Error('point requires x y');
        const x = values[0];
        const y = values[1];
        let z = 0;
        let radius = 6;
        if (values.length >= 4) {
          z = values[2];
          radius = values[3];
        } else if (values.length >= 3) {
          radius = values[2];
        }
        const style = createStyle(styles);
        for (const t of styles) {
          if (t.startsWith('radius=')) radius = toNum(t.slice(7), radius);
          if (t.startsWith('r=')) radius = toNum(t.slice(2), radius);
          if (t.startsWith('size=')) radius = toNum(t.slice(5), radius);
        }
        await this.addAnimatedObject(
          { type: 'point', progress: 0, position: point3(x, y, z), radius, style },
          animationTimeMs(style, 0.4) / 1000,
          style.ease
        );
        break;
      }

      case 'line': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        let points: Point3[];
        if (values.length >= 6) {
          points = [point3(values[0], values[1], values[2]), point3(values[3], values[4], values[5])];
        } else if (values.length >= 4) {
          points = [point3(values[0], values[1], 0), point3(values[2], values[3], 0)];
        } else {
          throw new Error('line requires x1 y1 x2 y2 OR x1 y1 z1 x2 y2 z2');
        }
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'line', progress: 0, points, style },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'arrow': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        let points: Point3[];
        if (values.length >= 6) {
          points = [point3(values[0], values[1], values[2]), point3(values[3], values[4], values[5])];
        } else if (values.length >= 4) {
          points = [point3(values[0], values[1], 0), point3(values[2], values[3], 0)];
        } else {
          throw new Error('arrow requires 4 or 6 coordinates');
        }
        let head = 12;
        for (const t of styles) {
          if (t.startsWith('head=')) head = toNum(t.slice(5), 12);
        }
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'line', progress: 0, points, style, arrow: true, head },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'circle': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 3) throw new Error('circle requires x y radius OR x y z radius');
        const center =
          values.length >= 4 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1], 0);
        const radius = values.length >= 4 ? values[3] : values[2];
        const style = createStyle(styles);
        let plane = 'xy';
        for (const t of styles) {
          if (t.startsWith('plane=')) plane = t.slice(6).toLowerCase();
        }
        await this.addAnimatedObject(
          {
            type: 'circle',
            progress: 0,
            center,
            rx: radius,
            ry: radius,
            start: 0,
            end: Math.PI * 2,
            closed: true,
            plane,
            style,
          },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'ellipse': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 4) throw new Error('ellipse requires x y rx ry');
        const center =
          values.length >= 5 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1], 0);
        const rx = values.length >= 5 ? values[3] : values[2];
        const ry = values.length >= 5 ? values[4] : values[3];
        const style = createStyle(styles);
        let plane = 'xy';
        for (const t of styles) {
          if (t.startsWith('plane=')) plane = t.slice(6).toLowerCase();
        }
        await this.addAnimatedObject(
          {
            type: 'ellipse',
            progress: 0,
            center,
            rx,
            ry,
            start: 0,
            end: Math.PI * 2,
            closed: true,
            plane,
            style,
          },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'arc': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 5) throw new Error('arc requires x y radius startAngle endAngle');
        const center =
          values.length >= 6 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1], 0);
        const radius = values.length >= 6 ? values[3] : values[2];
        const start = values.length >= 6 ? values[4] : values[3];
        const end = values.length >= 6 ? values[5] : values[4];
        const style = createStyle(styles);
        let plane = 'xy';
        for (const t of styles) {
          if (t.startsWith('plane=')) plane = t.slice(6).toLowerCase();
        }
        await this.addAnimatedObject(
          {
            type: 'arc',
            progress: 0,
            center,
            rx: radius,
            ry: radius,
            start,
            end,
            closed: false,
            plane,
            style,
          },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'rect':
      case 'rectangle': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 4) throw new Error('rect requires x y width height');
        const x = values[0];
        const y = values[1];
        const z = values.length >= 5 ? values[2] : 0;
        const w = values.length >= 5 ? values[3] : values[2];
        const h = values.length >= 5 ? values[4] : values[3];
        const style = createStyle(styles);
        const points = [
          point3(x, y, z),
          point3(x + w, y, z),
          point3(x + w, y + h, z),
          point3(x, y + h, z),
        ];
        await this.addAnimatedObject(
          { type: 'path', progress: 0, points, closed: true, style },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'roundrect': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 5) throw new Error('roundrect requires x y width height radius');
        const x = values[0];
        const y = values[1];
        const z = values.length >= 6 ? values[2] : 0;
        const w = values.length >= 6 ? values[3] : values[2];
        const h = values.length >= 6 ? values[4] : values[3];
        let r = values.length >= 6 ? values[5] : values[4];
        r = Math.min(r, w / 2, h / 2);
        const points: Point3[] = [];
        const addArc = (cx: number, cy: number, start: number, end: number) => {
          for (let i = 0; i <= 12; i++) {
            const t = start + (end - start) * (i / 12);
            points.push(point3(cx + r * Math.cos(t), cy + r * Math.sin(t), z));
          }
        };
        addArc(x + r, y + r, Math.PI, Math.PI * 1.5);
        addArc(x + w - r, y + r, Math.PI * 1.5, Math.PI * 2);
        addArc(x + w - r, y + h - r, 0, Math.PI * 0.5);
        addArc(x + r, y + h - r, Math.PI * 0.5, Math.PI);
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'path', progress: 0, points, closed: true, style },
          animationTimeMs(style, 0.9) / 1000,
          style.ease
        );
        break;
      }

      case 'triangle':
      case 'polygon':
      case 'polyline': {
        const closed = parsed.name !== 'polyline';
        const { geometry, styles } = this.splitGeometryAndStyle(args);
        let dimensions = 2;
        if (geometry.length >= 9 && geometry.length % 3 === 0 && geometry.length % 2 !== 0) {
          dimensions = 3;
        }
        for (const t of styles) {
          if (t === '3d' || t === 'xyz') dimensions = 3;
        }
        const points: Point3[] = [];
        if (dimensions === 3) {
          if (geometry.length < 6 || geometry.length % 3 !== 0) {
            throw new Error('3D polygon requires XYZ coordinate triples');
          }
          for (let i = 0; i < geometry.length; i += 3) {
            points.push(point3(geometry[i], geometry[i + 1], geometry[i + 2]));
          }
        } else {
          if (geometry.length < 4 || geometry.length % 2 !== 0) {
            throw new Error('polygon/polyline requires XY coordinate pairs');
          }
          for (let i = 0; i < geometry.length; i += 2) {
            points.push(point3(geometry[i], geometry[i + 1], 0));
          }
        }
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'path', progress: 0, points, closed, style },
          animationTimeMs(style, 1.1) / 1000,
          style.ease
        );
        break;
      }

      case 'quadratic': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 6) throw new Error('quadratic requires x0 y0 cx cy x1 y1');
        const p0 = values.length >= 9 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1]);
        const pc = values.length >= 9 ? point3(values[3], values[4], values[5]) : point3(values[2], values[3]);
        const p1 = values.length >= 9 ? point3(values[6], values[7], values[8]) : point3(values[4], values[5]);
        const style = createStyle(styles);
        const samples: Point3[] = [];
        const SAMPLE_COUNT = 120;
        for (let i = 0; i <= SAMPLE_COUNT; i++) {
          const t = i / SAMPLE_COUNT;
          const u = 1 - t;
          samples.push({
            x: u * u * p0.x + 2 * u * t * pc.x + t * t * p1.x,
            y: u * u * p0.y + 2 * u * t * pc.y + t * t * p1.y,
            z: u * u * p0.z + 2 * u * t * pc.z + t * t * p1.z,
          });
        }
        await this.addAnimatedObject(
          { type: 'curve', progress: 0, samples, style },
          animationTimeMs(style, 1.1) / 1000,
          style.ease
        );
        break;
      }

      case 'bezier':
      case 'cubic': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 8) throw new Error('bezier requires 8 or 12 coordinates');
        const p0 = values.length >= 12 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1]);
        const c1 = values.length >= 12 ? point3(values[3], values[4], values[5]) : point3(values[2], values[3]);
        const c2 = values.length >= 12 ? point3(values[6], values[7], values[8]) : point3(values[4], values[5]);
        const p1 = values.length >= 12 ? point3(values[9], values[10], values[11]) : point3(values[6], values[7]);
        const style = createStyle(styles);
        const samples: Point3[] = [];
        const SAMPLE_COUNT = 140;
        for (let i = 0; i <= SAMPLE_COUNT; i++) {
          const t = i / SAMPLE_COUNT;
          const u = 1 - t;
          samples.push({
            x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p1.x,
            y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p1.y,
            z: u * u * u * p0.z + 3 * u * u * t * c1.z + 3 * u * t * t * c2.z + t * t * t * p1.z,
          });
        }
        await this.addAnimatedObject(
          { type: 'curve', progress: 0, samples, style },
          animationTimeMs(style, 1.3) / 1000,
          style.ease
        );
        break;
      }

      case 'cylinder': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 5) throw new Error('cylinder requires x y z radius height');
        const center = point3(values[0], values[1], values[2]);
        const radius = values[3];
        const height = values[4];
        const style = createStyle(styles);
        const geometry = this.cylinderGeometry(center, radius, height, 60);
        const geometryPoints = [...geometry.bottom, ...geometry.top];
        await this.addAnimatedObject(
          { type: 'cylinder', progress: 0, center, radius, height, geometry, geometryPoints, style },
          animationTimeMs(style, 1.5) / 1000,
          style.ease
        );
        break;
      }

      case 'cone': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 5) throw new Error('cone requires x y z radius height');
        const center = point3(values[0], values[1], values[2]);
        const radius = values[3];
        const height = values[4];
        const style = createStyle(styles);
        const geometry = this.coneGeometry(center, radius, height, 60);
        const geometryPoints = [...geometry.base, geometry.apex];
        await this.addAnimatedObject(
          { type: 'cone', progress: 0, center, radius, height, geometry, geometryPoints, style },
          animationTimeMs(style, 1.5) / 1000,
          style.ease
        );
        break;
      }

      case 'text':
      case 'label': {
        if (args.length < 3) throw new Error('text requires x y "text"');
        const x = toNum(args[0]);
        const y = toNum(args[1]);
        const text = stripQuotes(args[2]);
        let z = 0;
        let start = 3;
        if (isNumberToken(args[3])) {
          z = toNum(args[3]);
          start = 4;
        }
        let color = '#ffffff';
        let font = '22px Plus Jakarta Sans, sans-serif';
        let align: CanvasTextAlign = 'left';
        let baseline: CanvasTextBaseline = 'alphabetic';
        let glow = 0;
        let opacity = 1;

        for (const token of args.slice(start)) {
          if (isColor(token)) {
            color = token;
            continue;
          }
          if (isFont(token)) {
            font = stripQuotes(token);
            continue;
          }
          if (token.startsWith('color=')) color = stripQuotes(token.slice(6));
          else if (token.startsWith('font=')) font = stripQuotes(token.slice(5));
          else if (token.startsWith('align=')) align = token.slice(6) as CanvasTextAlign;
          else if (token.startsWith('baseline=')) baseline = token.slice(9) as CanvasTextBaseline;
          else if (token.startsWith('glow=')) glow = toNum(token.slice(5), 0);
          else if (token.startsWith('opacity=')) opacity = clamp(toNum(token.slice(8), 1), 0, 1);
        }

        await this.addAnimatedObject(
          {
            type: 'text',
            progress: 0,
            position: point3(x, y, z),
            text,
            color,
            font,
            align,
            baseline,
            glow,
            opacity,
          },
          0.35,
          'out'
        );
        break;
      }

      case 'highlight': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 3) throw new Error('highlight requires x y radius');
        const center =
          values.length >= 4 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1]);
        const radius = values.length >= 4 ? values[3] : values[2];
        const style = createStyle(styles);
        if (!styles.some(isColor)) {
          style.color = '#facc15';
          style.glowColor = '#facc15';
        }
        style.glow = style.glow || 15;
        await this.addAnimatedObject(
          { type: 'highlight', progress: 0, center, radius, style },
          animationTimeMs(style, 0.7) / 1000,
          style.ease
        );
        break;
      }

      case 'cross': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 3) throw new Error('cross requires x y radius');
        const center =
          values.length >= 4 ? point3(values[0], values[1], values[2]) : point3(values[0], values[1]);
        const radius = values.length >= 4 ? values[3] : values[2];
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'cross', progress: 0, center, radius, style },
          animationTimeMs(style, 0.5) / 1000,
          style.ease
        );
        break;
      }

      case 'bracket': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 4) throw new Error('bracket requires x y width height');
        const x = values[0];
        const y = values[1];
        const z = values.length >= 5 ? values[2] : 0;
        const width = values.length >= 5 ? values[3] : values[2];
        const height = values.length >= 5 ? values[4] : values[3];
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'bracket', progress: 0, x, y, z, width, height, style },
          animationTimeMs(style, 0.8) / 1000,
          style.ease
        );
        break;
      }

      case 'grid': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        if (values.length < 5) throw new Error('grid requires x y cellSize rows cols');
        const x = values[0];
        const y = values[1];
        const z = values.length >= 6 ? values[2] : 0;
        const cell = values.length >= 6 ? values[3] : values[2];
        const rows = Math.floor(values.length >= 6 ? values[4] : values[3]);
        const cols = Math.floor(values.length >= 6 ? values[5] : values[4]);
        const style = createStyle(styles);
        await this.addAnimatedObject(
          { type: 'grid', progress: 0, x, y, z, cell, rows, cols, style },
          animationTimeMs(style, 0.5) / 1000,
          style.ease
        );
        break;
      }

      case 'axes': {
        const { geometry: values, styles } = this.splitGeometryAndStyle(args);
        let ox = 400;
        let oy = 300;
        let oz = 0;
        let length = 180;
        if (values.length >= 4) {
          ox = values[0];
          oy = values[1];
          oz = values[2];
          length = values[3];
        } else if (values.length >= 3) {
          ox = values[0];
          oy = values[1];
          length = values[2];
        }
        const style = createStyle(styles);
        const sArgs = [style.color, `${style.speed}x`, `width=${style.width}`, `glow=${style.glow}`];
        await this.executeCommand(`arrow ${ox} ${oy} ${oz} ${ox + length} ${oy} ${oz} ${sArgs.join(' ')}`);
        await this.executeCommand(`arrow ${ox} ${oy} ${oz} ${ox} ${oy - length} ${oz} ${sArgs.join(' ')}`);
        await this.executeCommand(`arrow ${ox} ${oy} ${oz} ${ox} ${oy} ${oz + length} ${sArgs.join(' ')}`);
        break;
      }

      case 'image': {
        if (args.length < 1) throw new Error('image requires "URL" x y width height');
        const src = stripQuotes(args[0]);
        const { geometry: values, styles } = this.splitGeometryAndStyle(args.slice(1));
        const x = values[0] ?? 400;
        const y = values[1] ?? 300;
        const z = values.length >= 5 ? values[2] : 0;
        const w = values.length >= 5 ? values[3] : values[2];
        const h = values.length >= 5 ? values[4] : values[3];
        let opacity = 1;
        for (const t of styles) {
          if (t.startsWith('opacity=')) opacity = clamp(toNum(t.slice(8), 1), 0, 1);
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('image failed to load'));
        });
        await this.addAnimatedObject(
          {
            type: 'image',
            progress: 0,
            position: point3(x, y, z),
            width: w ?? img.width,
            height: h ?? img.height,
            opacity,
            image: img,
          },
          0.5,
          'out'
        );
        break;
      }

      case 'clear': {
        this.clear();
        break;
      }

      case 'wait': {
        const secs = toNum(args[0], 1);
        if (!this.instantMode) {
          await this.sleep((secs * 1000) / this.speedMultiplier);
        }
        break;
      }

      default:
        throw new Error(`Unknown command: ${parsed.name}`);
    }
  }
}
