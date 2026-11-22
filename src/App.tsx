/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { CanvasStage } from './components/CanvasStage';
import { PromptBuilder } from './components/PromptBuilder';
import { ExtensionStudio } from './components/ExtensionStudio';
import { CommandDocs } from './components/CommandDocs';
import { LESSON_PRESETS } from './data/presets';
import { extractDrawScriptFromResponse } from './engine/drawscriptEngine';
import { downloadExtensionZip } from './extension/extensionFiles';

type ActiveTab = 'canvas' | 'prompt' | 'extension' | 'docs';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('canvas');
  const [script, setScript] = useState<string>(LESSON_PRESETS[0].script);
  const [playTrigger, setPlayTrigger] = useState(0);
  const [instantTrigger, setInstantTrigger] = useState(0);
  const [isoOnLoad, setIsoOnLoad] = useState(false);
  const [bridgeSourceLabel, setBridgeSourceLabel] = useState<string | null>(null);
  const [downloadingExt, setDownloadingExt] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const loadScriptIntoCanvas = (
    rawScript: string,
    sourceLabel: string,
    iso = false
  ) => {
    const { script: cleaned } = extractDrawScriptFromResponse(rawScript);
    setScript(cleaned);
    setIsoOnLoad(iso);
    setBridgeSourceLabel(sourceLabel);
    setActiveTab('canvas');
    setPlayTrigger((n) => n + 1);
  };

  // Listen for Chrome Extension bridge messages & URL hash payloads
  useEffect(() => {
    const applyHashPayload = () => {
      const hash = window.location.hash;
      if (hash && hash.startsWith('#drawscript=')) {
        try {
          const decoded = decodeURIComponent(hash.slice('#drawscript='.length));
          if (decoded.trim()) {
            loadScriptIntoCanvas(decoded, 'ChatGPT Extension Bridge');
            history.replaceState(null, '', window.location.pathname + window.location.search);
          }
        } catch {
          // Ignore malformed hash payloads
        }
      }
    };

    const handleMessage = (event: MessageEvent) => {
      if (
        event.data &&
        event.data.type === 'DRAWSCRIPT_LOAD_SCRIPT' &&
        typeof event.data.script === 'string'
      ) {
        loadScriptIntoCanvas(
          event.data.script,
          event.data.source ? `Extension (${event.data.source})` : 'Chrome Extension'
        );
      }
    };

    applyHashPayload();
    window.addEventListener('hashchange', applyHashPayload);
    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('hashchange', applyHashPayload);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const handleHeaderDownload = async () => {
    setDownloadingExt(true);
    setDownloadError(null);
    try {
      const origin =
        typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
      await downloadExtensionZip(origin);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : 'Could not package the extension.');
    } finally {
      setDownloadingExt(false);
    }
  };

  const navItems: { id: ActiveTab; label: string }[] = [
    { id: 'canvas', label: '3D Canvas' },
    { id: 'prompt', label: 'Prompt Builder' },
    { id: 'extension', label: 'Chrome Extension' },
    { id: 'docs', label: 'Command Docs' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0B1120] text-slate-100">
      {/* Three-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 bg-[#0B1120]/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('canvas');
            }}
            className="text-lg font-display font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            DrawScript
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary"
            className="flex items-center gap-5 sm:gap-7 overflow-x-auto min-w-0 flex-1 sm:flex-none [scrollbar-width:none]"
          >
            {navItems.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`py-5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:text-white focus-visible:border-sky-300 ${
                    active
                      ? 'border-sky-400 text-white'
                      : 'border-transparent text-slate-400 hover:text-slate-100'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={handleHeaderDownload}
              disabled={downloadingExt}
              className="px-3 sm:px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
            >
              {downloadingExt ? (
                'Packaging...'
              ) : (
                <>
                  <span className="sm:hidden">Extension</span>
                  <span className="hidden sm:inline">Download Extension</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {downloadError && (
        <div
          role="alert"
          className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 pt-4"
        >
          <div className="flex items-start justify-between gap-3 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-200">
            <span>Extension download failed: {downloadError}</span>
            <button
              type="button"
              onClick={() => setDownloadError(null)}
              className="text-rose-300 hover:text-white cursor-pointer shrink-0"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'canvas' && (
          <CanvasStage
            script={script}
            onScriptChange={setScript}
            playTrigger={playTrigger}
            instantTrigger={instantTrigger}
            isoOnLoad={isoOnLoad}
            bridgeSourceLabel={bridgeSourceLabel}
          />
        )}

        {activeTab === 'prompt' && (
          <PromptBuilder
            onLoadIntoCanvas={(nextScript, label) =>
              loadScriptIntoCanvas(nextScript, label, false)
            }
          />
        )}

        {activeTab === 'extension' && (
          <ExtensionStudio
            onLoadIntoCanvas={(nextScript, label) =>
              loadScriptIntoCanvas(nextScript, label, true)
            }
          />
        )}

        {activeTab === 'docs' && (
          <CommandDocs
            onLoadIntoCanvas={(nextScript, label, iso) =>
              loadScriptIntoCanvas(nextScript, label, Boolean(iso))
            }
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-4 sm:px-6">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <span>DrawScript 3D · Open-source visual lesson engine &amp; Manifest V3 ChatGPT/Claude bridge</span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => {
                setActiveTab('canvas');
                setInstantTrigger((n) => n + 1);
              }}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Quick Render
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('extension')}
              className="hover:text-slate-300 transition-colors cursor-pointer"
            >
              Extension Installer
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
