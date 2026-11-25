import React, { useMemo, useState } from 'react';
import {
  Download,
  Copy,
  Check,
  FileCode2,
  Play,
  Wand2,
} from 'lucide-react';
import {
  buildExtensionFiles,
  studioBaseUrl,
  downloadExtensionZip,
} from '../extension/extensionFiles';
import { extractDrawScriptFromResponse } from '../engine/drawscriptEngine';
import { SIMULATED_CHATGPT_REPLY } from '../data/presets';

interface ExtensionStudioProps {
  onLoadIntoCanvas: (script: string, sourceLabel: string) => void;
}

const SAMPLE_KATEX_DOM_HTML = `<div data-message-author-role="assistant">
  <pre><code>Let us draw a 3D cylinder and highlight its circular base.
\\(axes 400 360 0 180 color=#64748b width=2\\)
\\(cylinder 400 360 0 75 150 #38bdf8 width=1.4 fill=rgba(56,189,248,0.16)\\)
Notice the circular radius at the top rim.
\\(text 400 185 "Cylinder h=150, r=75" 0 #facc15 font="18px sans-serif" align=center\\)</code></pre>
</div>`;

function runDomExtractorSimulation(input: string): {
  extracted: string;
  commandCount: number;
  speechSegments: number;
} {
  // If user pasted ChatGPT HTML containing KaTeX nodes, parse with DOMParser just like content.js
  if (/<[a-z][\s\S]*>/i.test(input) && typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(input, 'text/html');
    let out = '';

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out += node.nodeValue || '';
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (el.classList.contains('katex') || el.classList.contains('katex-display')) {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        if (ann?.textContent) {
          out += `\\(${ann.textContent.trim()}\\)`;
          return;
        }
      }
      if (el.tagName === 'BR') {
        out += '\n';
        return;
      }
      const isBlock = /^(P|DIV|LI|PRE|H1|H2|H3|H4|BLOCKQUOTE)$/i.test(el.tagName);
      el.childNodes.forEach(walk);
      if (isBlock) out += '\n';
    };

    walk(doc.body);
    const result = extractDrawScriptFromResponse(out);
    return {
      extracted: result.script,
      commandCount: result.commandCount,
      speechSegments: result.speechSegments,
    };
  }

  const result = extractDrawScriptFromResponse(input);
  return {
    extracted: result.script,
    commandCount: result.commandCount,
    speechSegments: result.speechSegments,
  };
}

export const ExtensionStudio: React.FC<ExtensionStudioProps> = ({
  onLoadIntoCanvas,
}) => {
  const defaultOrigin = studioBaseUrl();

  const [bridgeOrigin, setBridgeOrigin] = useState(defaultOrigin);
  const [downloading, setDownloading] = useState(false);
  const [selectedPath, setSelectedPath] = useState('content.js');
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const [rawResponseInput, setRawResponseInput] = useState(SAMPLE_KATEX_DOM_HTML);

  const files = useMemo(() => buildExtensionFiles(bridgeOrigin), [bridgeOrigin]);
  const activeFile = useMemo(
    () => files.find((f) => f.path === selectedPath) ?? files[0],
    [files, selectedPath]
  );

  const simulatedExtraction = useMemo(
    () => runDomExtractorSimulation(rawResponseInput),
    [rawResponseInput]
  );

  const handleDownloadZip = async () => {
    setDownloading(true);
    try {
      await downloadExtensionZip(bridgeOrigin);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopyFile = async () => {
    await navigator.clipboard.writeText(activeFile.content);
    setCopiedFile(activeFile.path);
    setTimeout(() => setCopiedFile(null), 1800);
  };

  return (
    <div className="space-y-8">
      {/* Header & Primary Download Action */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 border-b border-slate-800 pb-6">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            Manifest V3 Chrome Extension Builder
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Because Sign in with ChatGPT restricts free-tier access, this extension runs directly on{' '}
            <code className="font-mono text-slate-200">chatgpt.com</code> and{' '}
            <code className="font-mono text-slate-200">claude.ai</code>—recovering{' '}
            <code className="font-mono text-sky-300">\(command\)</code> blocks even through KaTeX math rendering and drawing them in 3D.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="flex flex-col">
            <label htmlFor="bridge-origin" className="text-[11px] text-slate-400 mb-1">
              Bridge Studio URL
            </label>
            <input
              id="bridge-origin"
              type="text"
              value={bridgeOrigin}
              onChange={(e) => setBridgeOrigin(e.target.value)}
              className="w-64 px-3 py-1.5 rounded-lg bg-[#030712] border border-slate-700 text-xs font-mono text-slate-200 focus:border-sky-500 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleDownloadZip}
            disabled={downloading}
            className="self-end inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            {downloading ? 'Packaging Extension...' : 'Download Extension (.zip)'}
          </button>
        </div>
      </div>

      {/* 4-Step Unpacked Installation Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            step: '01. Download & Unzip',
            detail: 'Click Download Extension (.zip) above and extract the folder on your computer.',
          },
          {
            step: '02. Open Extensions',
            detail: 'Navigate to chrome://extensions in Chrome, Edge, or Brave and turn on Developer mode.',
          },
          {
            step: '03. Load Unpacked',
            detail: 'Click Load unpacked and select the extracted folder containing manifest.json.',
          },
          {
            step: '04. Draw on ChatGPT',
            detail: 'Open chatgpt.com or claude.ai, click + Wrap DrawScript Prompt, and hit Play in DrawScript 3D.',
          },
        ].map((item) => (
          <div
            key={item.step}
            className="p-4 rounded-xl bg-[#0F172A] border border-slate-800"
          >
            <h2 className="text-sm font-semibold text-slate-100">{item.step}</h2>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{item.detail}</p>
          </div>
        ))}
      </div>

      {/* Live ChatGPT DOM & KaTeX Extractor Simulator */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#111827]">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              ChatGPT DOM & KaTeX Extractor Testbench
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Test how <code className="font-mono text-slate-300">content.js</code> recovers{' '}
              <code className="font-mono text-sky-300">\( ... \)</code> commands when ChatGPT turns them into KaTeX math nodes.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRawResponseInput(SAMPLE_KATEX_DOM_HTML)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Load KaTeX HTML Sample
            </button>
            <button
              type="button"
              onClick={() => setRawResponseInput(SIMULATED_CHATGPT_REPLY)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
            >
              Load Raw Markdown Sample
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          <div className="p-4 flex flex-col gap-2">
            <label htmlFor="dom-input" className="text-xs font-semibold text-slate-300">
              Raw ChatGPT Page DOM / Assistant Reply
            </label>
            <textarea
              id="dom-input"
              value={rawResponseInput}
              onChange={(e) => setRawResponseInput(e.target.value)}
              spellCheck={false}
              className="w-full h-56 p-3 rounded-lg bg-[#030712] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs font-mono text-slate-300 resize-none leading-relaxed"
            />
          </div>

          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300">
                Extracted DrawScript Output
              </span>
              <span className="text-xs text-slate-400 tabular-nums">
                {simulatedExtraction.commandCount} commands · {simulatedExtraction.speechSegments} narration lines
              </span>
            </div>
            <pre className="w-full h-56 p-3 rounded-lg bg-[#030712] border border-slate-800 text-xs font-mono text-sky-200 overflow-auto whitespace-pre-wrap leading-relaxed">
              {simulatedExtraction.extracted || 'No DrawScript commands detected yet.'}
            </pre>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={!simulatedExtraction.extracted}
                onClick={() =>
                  onLoadIntoCanvas(simulatedExtraction.extracted, 'Extension DOM Extractor')
                }
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Load Extracted Script into 3D Engine
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Extension Source Code Explorer */}
      <section className="bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-2">
            <Wand2 className="w-4 h-4 text-sky-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              Extension Source Files ({files.length} files + PNG icons)
            </h2>
          </div>
          <button
            type="button"
            onClick={handleCopyFile}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer whitespace-nowrap"
          >
            {copiedFile === activeFile.path ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            {copiedFile === activeFile.path ? `Copied ${activeFile.path}` : `Copy ${activeFile.path}`}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* File list */}
          <div className="lg:col-span-3 border-b lg:border-b-0 lg:border-r border-slate-800 p-2 space-y-1 bg-[#0B1120]">
            {files.map((file) => {
              const active = file.path === activeFile.path;
              return (
                <button
                  key={file.path}
                  type="button"
                  onClick={() => setSelectedPath(file.path)}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-mono transition-colors cursor-pointer ${
                    active
                      ? 'bg-sky-950/60 text-sky-200 border border-sky-700/50'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-transparent'
                  }`}
                >
                  <FileCode2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{file.path}</span>
                </button>
              );
            })}
          </div>

          {/* Code Viewer */}
          <div className="lg:col-span-9 flex flex-col">
            <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0F172A] text-xs text-slate-400 flex items-center justify-between gap-2">
              <span>{activeFile.description}</span>
              <span className="font-mono text-slate-500 tabular-nums shrink-0">
                {activeFile.content.split('\n').length} lines
              </span>
            </div>
            <pre className="p-4 bg-[#030712] text-xs font-mono text-slate-300 overflow-auto max-h-[440px] leading-relaxed">
              {activeFile.content}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
};
