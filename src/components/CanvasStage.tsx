import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Square,
  Zap,
  RotateCcw,
  Volume2,
  VolumeX,
  Trash2,
  Box,
  ClipboardPaste,
} from 'lucide-react';
import {
  DrawScriptEngine,
  EngineSnapshot,
  extractDrawScriptFromResponse,
  parseDrawScript,
} from '../engine/drawscriptEngine';
import { LESSON_PRESETS } from '../data/presets';

interface CanvasStageProps {
  script: string;
  onScriptChange: (next: string) => void;
  playTrigger: number;
  instantTrigger: number;
  isoOnLoad?: boolean;
  bridgeSourceLabel?: string | null;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  script,
  onScriptChange,
  playTrigger,
  instantTrigger,
  isoOnLoad = false,
  bridgeSourceLabel = null,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<DrawScriptEngine | null>(null);
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchDistRef = useRef<number | null>(null);
  const pinchMidRef = useRef<{ x: number; y: number } | null>(null);
  // Coalesce high-frequency pointer events into one canvas render per animation frame.
  const orbitDeltaRef = useRef({ x: 0, y: 0 });
  const orbitFrameRef = useRef<number | null>(null);

  const [speechEnabled, setSpeechEnabled] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [deckTab, setDeckTab] = useState<'script' | 'timeline'>('script');
  const [snapshot, setSnapshot] = useState<EngineSnapshot>({
    playback: 'idle',
    activePartIndex: -1,
    totalParts: 0,
    caption: '',
    statusMessage: 'Ready · 3D orthographic world',
    errorMessage: null,
    camera: { yawDeg: 0, pitchDeg: 0, zoom: 1 },
    objectCount: 0,
  });

  const parsedParts = useMemo(() => parseDrawScript(script), [script]);
  const commandCount = useMemo(
    () => parsedParts.filter((p) => p.type === 'draw').length,
    [parsedParts]
  );

  // Initialize DrawScript 3D Engine
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const engine = new DrawScriptEngine(canvas, (nextSnap) => {
      setSnapshot(nextSnap);
    });
    engineRef.current = engine;

    const handleResize = () => engine.resize();
    const ro = new ResizeObserver(handleResize);
    ro.observe(canvas);
    window.addEventListener('resize', handleResize);

    // Initial render of default script
    engine.play(script, { instant: true });

    return () => {
      if (orbitFrameRef.current !== null) cancelAnimationFrame(orbitFrameRef.current);
      orbitFrameRef.current = null;
      orbitDeltaRef.current = { x: 0, y: 0 };
      engine.stop();
      ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Trigger animated play when parent pushes a new script or preset
  useEffect(() => {
    if (playTrigger === 0 || !engineRef.current) return;
    if (isoOnLoad) {
      engineRef.current.setIsoPreset();
    } else {
      engineRef.current.resetCamera();
    }
    engineRef.current.play(script, { instant: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playTrigger]);

  // Trigger instant play when requested
  useEffect(() => {
    if (instantTrigger === 0 || !engineRef.current) return;
    if (isoOnLoad) {
      engineRef.current.setIsoPreset();
    }
    engineRef.current.play(script, { instant: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instantTrigger]);

  useEffect(() => {
    engineRef.current?.setSpeechEnabled(speechEnabled);
  }, [speechEnabled]);

  useEffect(() => {
    engineRef.current?.setSpeedMultiplier(speed);
  }, [speed]);

  const handlePlay = () => {
    engineRef.current?.play(script, { instant: false });
  };

  const handleInstant = () => {
    engineRef.current?.play(script, { instant: true });
  };

  const handleStop = () => {
    engineRef.current?.stop();
  };

  const handleClear = () => {
    engineRef.current?.stop();
    engineRef.current?.clear();
  };

  const handleResetCamera = () => {
    engineRef.current?.resetCamera();
  };

  const handleIsoPreset = () => {
    engineRef.current?.setIsoPreset();
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) return;
      const { script: extracted } = extractDrawScriptFromResponse(text);
      onScriptChange(extracted);
      engineRef.current?.play(extracted, { instant: false });
    } catch {
      // Clipboard access denied or unavailable
    }
  };

  // Pointer Orbit / Pinch / Pan handlers
  const getLocalPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const pos = getLocalPos(e);
    pointersRef.current.set(e.pointerId, pos);
    setIsDragging(true);

    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchDistRef.current = Math.hypot(a.x - b.x, a.y - b.y);
      pinchMidRef.current = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    }
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev || !engineRef.current) return;
    const next = getLocalPos(e);
    pointersRef.current.set(e.pointerId, next);

    if (pointersRef.current.size === 1) {
      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      orbitDeltaRef.current.x += dx;
      orbitDeltaRef.current.y += dy;
      if (orbitFrameRef.current === null) {
        orbitFrameRef.current = requestAnimationFrame(() => {
          orbitFrameRef.current = null;
          const delta = orbitDeltaRef.current;
          orbitDeltaRef.current = { x: 0, y: 0 };
          engineRef.current?.orbitBy(delta.x, delta.y);
        });
      }
    } else if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

      if (pinchDistRef.current && dist > 0) {
        engineRef.current.zoomByFactor(dist / pinchDistRef.current);
      }
      if (pinchMidRef.current) {
        engineRef.current.panBy(mid.x - pinchMidRef.current.x, mid.y - pinchMidRef.current.y);
      }
      pinchDistRef.current = dist;
      pinchMidRef.current = mid;
    }
  };

  const onPointerUpOrCancel = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) {
      pinchDistRef.current = null;
      pinchMidRef.current = null;
    }
    if (pointersRef.current.size === 0) {
      setIsDragging(false);
    }
  };

  const onWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    engineRef.current?.zoomByFactor(Math.exp(-e.deltaY * 0.001));
  };

  const isPlaying = snapshot.playback === 'playing';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
      {/* Left / Main 3D Stage (7 cols ~ 60%) */}
      <section className="lg:col-span-7 xl:col-span-8 flex flex-col bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
        {/* Stage Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-2">
            {!isPlaying ? (
              <button
                type="button"
                onClick={handlePlay}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                Animate Lesson
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" />
                Stop
              </button>
            )}

            <button
              type="button"
              onClick={handleInstant}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Draw all geometry immediately without narration wait"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Draw Instant
            </button>

            <button
              type="button"
              onClick={handleIsoPreset}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Tilt camera to 3D isometric angle"
            >
              <Box className="w-3.5 h-3.5 text-sky-400" />
              3D Tilt
            </button>

            <button
              type="button"
              onClick={handleResetCamera}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Reset camera (or double-click canvas)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset View
            </button>

            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Clear canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
              {[0.75, 1, 1.5, 2].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSpeed(val)}
                  className={`px-2 py-1 text-xs font-mono tabular-nums rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    speed === val
                      ? 'bg-slate-700 text-white font-semibold'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {val}x
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setSpeechEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                speechEnabled
                  ? 'bg-sky-950/60 border-sky-700/60 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              aria-pressed={speechEnabled}
            >
              {speechEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              Voice {speechEnabled ? 'On' : 'Muted'}
            </button>
          </div>
        </div>

        {/* 3D Canvas Viewport */}
        <div className="relative flex-1 min-h-[440px] lg:min-h-[540px] bg-[#030712]">
          <canvas
            ref={canvasRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUpOrCancel}
            onPointerCancel={onPointerUpOrCancel}
            onWheel={onWheel}
            onDoubleClick={handleResetCamera}
            className={`w-full h-full block touch-none ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
          />

          {/* Top-left subtle metadata readout (unboxed text, tabular nums) */}
          <div className="pointer-events-none absolute top-3 left-4 flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
            <span>Yaw {snapshot.camera.yawDeg}°</span>
            <span aria-hidden="true">·</span>
            <span>Pitch {snapshot.camera.pitchDeg}°</span>
            <span aria-hidden="true">·</span>
            <span>Zoom {snapshot.camera.zoom.toFixed(2)}×</span>
            <span aria-hidden="true">·</span>
            <span>{snapshot.objectCount} objects</span>
            {bridgeSourceLabel && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-sky-400">Loaded from {bridgeSourceLabel}</span>
              </>
            )}
          </div>

          <div className="pointer-events-none absolute top-3 right-4 text-xs text-slate-500 hidden sm:block">
            Drag to orbit · Scroll to zoom · Double-click to reset
          </div>

          {/* Narration Caption Strip */}
          {snapshot.caption && (
            <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex justify-center">
              <div className="max-w-2xl px-4 py-2 rounded-lg bg-slate-950/90 border border-slate-800 text-sm text-slate-100 text-center">
                {snapshot.caption}
              </div>
            </div>
          )}
        </div>

        {/* Stage Footer Readout */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-t border-slate-800 bg-[#0F172A] text-xs text-slate-400">
          <span className="font-mono truncate max-w-md">{snapshot.statusMessage}</span>
          {snapshot.errorMessage ? (
            <span className="text-amber-400 font-medium">{snapshot.errorMessage}</span>
          ) : (
            <span className="tabular-nums">
              {commandCount} draw commands · {parsedParts.length} total steps
            </span>
          )}
        </div>
      </section>

      {/* Right Control & Script Deck (5 cols ~ 40%) */}
      <aside className="lg:col-span-5 xl:col-span-4 flex flex-col bg-[#0F172A] border border-slate-800 rounded-xl overflow-hidden">
        {/* Preset Lesson Selector */}
        <div className="p-4 border-b border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <h2 className="text-sm font-semibold text-slate-100">Interactive Lessons</h2>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-400 hover:text-sky-300 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              Paste ChatGPT Reply
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {LESSON_PRESETS.map((preset) => {
              const isSelected = script.trim() === preset.script.trim();
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    onScriptChange(preset.script);
                    if (preset.isoView) {
                      engineRef.current?.setIsoPreset();
                    } else {
                      engineRef.current?.resetCamera();
                    }
                    engineRef.current?.play(preset.script, { instant: false });
                  }}
                  className={`text-left p-2.5 rounded-lg border transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-sky-950/40 border-sky-600/70 text-slate-100'
                      : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold truncate">{preset.title}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{preset.subject}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Script / Timeline Tabs */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-slate-800 bg-[#111827]">
          <div className="flex items-center gap-1 p-0.5 bg-slate-900 rounded-lg border border-slate-800">
            <button
              type="button"
              onClick={() => setDeckTab('script')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                deckTab === 'script'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Script Editor
            </button>
            <button
              type="button"
              onClick={() => setDeckTab('timeline')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                deckTab === 'timeline'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Parsed Steps ({parsedParts.length})
            </button>
          </div>
          <span className="text-xs text-slate-500">Enter \(cmd\) syntax</span>
        </div>

        {deckTab === 'script' ? (
          <div className="flex-1 flex flex-col p-4 gap-3 min-h-[280px]">
            <textarea
              value={script}
              onChange={(e) => onScriptChange(e.target.value)}
              spellCheck={false}
              aria-label="DrawScript source editor"
              placeholder='Paste ChatGPT output or type narration + \(circle 400 300 80 cyan\)'
              className="flex-1 w-full min-h-[240px] p-3 rounded-lg bg-[#030712] border border-slate-800 focus:border-sky-500 focus:outline-none text-xs leading-relaxed font-mono text-slate-200 resize-none"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-400 tabular-nums">
                {commandCount} draw commands ready
              </span>
              <button
                type="button"
                onClick={handlePlay}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                Run Script on 3D Canvas
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-2 max-h-[380px]">
            {parsedParts.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">
                No DrawScript commands parsed yet. Add narration or \(line ...\) blocks.
              </p>
            ) : (
              parsedParts.map((part, idx) => {
                const isActive = idx === snapshot.activePartIndex;
                return (
                  <div
                    key={part.id}
                    className={`p-2.5 rounded-lg border text-xs ${
                      isActive
                        ? 'bg-sky-950/50 border-sky-500/70 text-slate-100'
                        : 'bg-slate-900/60 border-slate-800 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                        Step {idx + 1} · {part.type === 'speech' ? 'Narration' : 'Draw 3D'}
                      </span>
                      {isActive && (
                        <span className="text-[11px] font-semibold text-sky-400">Active</span>
                      )}
                    </div>
                    {part.type === 'speech' ? (
                      <p className="text-slate-200 leading-relaxed">{part.text}</p>
                    ) : (
                      <code className="block font-mono text-amber-300 break-all">
                        \({part.command}\)
                      </code>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </aside>
    </div>
  );
};
