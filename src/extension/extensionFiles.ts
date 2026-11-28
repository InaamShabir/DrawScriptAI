import JSZip from 'jszip';
import { EXTENSION_TEXT_FILES } from './extensionData';

export interface ExtensionFile {
  path: string;
  language: 'json' | 'javascript' | 'html' | 'css' | 'markdown';
  description: string;
  content: string;
}

const DESCRIPTIONS: Record<string, string> = {
  'manifest.json': 'Manifest V3 configuration: permissions, content scripts, popup and options page.',
  'prompt.js': 'Builds the DrawScript instructions (generated from the app\'s default system prompt) plus your lesson options.',
  'engine.js': 'Canvas engine: parser, repair tolerance, every draw command, speed / voice / theme controls and PNG export.',
  'content.js': 'Runs on ChatGPT & Claude: dock, prompt insertion, auto-draw after the reply finishes, code-block bars and the 3D overlay.',
  'styles.css': 'Styles for the dock, code bars and overlay (responsive, touch friendly).',
  'player.js': 'Lesson player: step controls, pause, seek, speed, themes, PNG, video recording and sharing.',
  'library.js': 'Saves every lesson you draw so you can reopen it later.',
  'lab.html': 'DrawScript Lab page: ask an AI directly, paste a script, browse saved lessons.',
  'sample.js': 'A complete example lesson (NEET energy problem) used by the Lab.',
  'lab.css': 'Styles for the Lab page.',
  'lab.js': 'Lab logic: Gemini / OpenAI calls with your own key, paste-and-draw and the library.',
  'popup.html': 'Popup and options page markup.',
  'popup.css': 'Popup and options page styles.',
  'popup.js': 'Popup and options logic; every setting saves instantly.',
  'background.js': 'Service worker that opens or reuses the DrawScript Studio tab.',
  'bridge.js': 'Runs on the Studio page and hands scripts from the extension to the app.',
  'README.md': 'Quick-start instructions for loading the unpacked Chrome extension.',
};

const ORDER = [
  'manifest.json', 'content.js', 'engine.js', 'player.js', 'library.js', 'prompt.js', 'styles.css',
  'lab.html', 'lab.js', 'lab.css', 'sample.js',
  'popup.html', 'popup.js', 'popup.css', 'background.js', 'bridge.js', 'README.md',
];

function languageOf(path: string): ExtensionFile['language'] {
  if (path.endsWith('.json')) return 'json';
  if (path.endsWith('.html')) return 'html';
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.md')) return 'markdown';
  return 'javascript';
}

/** Address of this deployment of the Studio, including any sub-path (e.g. GitHub Pages). */
export function studioBaseUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:3000';
  const base = (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return (window.location.origin + base).replace(/\/+$/, '');
}

/** Files of the extension, with the Studio address filled in for this deployment. */
export function buildExtensionFiles(appOrigin: string): ExtensionFile[] {
  const origin = appOrigin.replace(/\/+$/, '');
  const hostPattern = `${origin}/*`;

  return ORDER.filter((path) => path in EXTENSION_TEXT_FILES).map((path) => {
    let content = EXTENSION_TEXT_FILES[path];

    if (path === 'manifest.json') {
      const manifest = JSON.parse(content);
      const addUnique = (list: string[], v: string) => {
        if (!list.includes(v)) list.push(v);
      };
      addUnique(manifest.host_permissions, hostPattern);
      for (const cs of manifest.content_scripts) {
        if (cs.js.includes('bridge.js')) addUnique(cs.matches, hostPattern);
      }
      content = JSON.stringify(manifest, null, 2);
    } else if (path === 'background.js' || path === 'popup.js') {
      content = content.replace('https://inaamshabir.github.io/drawScriptAI', origin);
    }

    return { path, language: languageOf(path), description: DESCRIPTIONS[path] || '', content };
  });
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
