import React, { useState } from 'react';
import { Play } from 'lucide-react';

interface CommandDocsProps {
  onLoadIntoCanvas: (script: string, sourceLabel: string, iso?: boolean) => void;
}

interface CommandItem {
  name: string;
  category: '3D Solids' | '2D & 3D Geometry' | 'Curves & Plots' | 'Annotations & Flow';
  syntax: string;
  description: string;
  exampleScript: string;
  iso?: boolean;
}

const COMMANDS: CommandItem[] = [
  {
    name: 'cylinder',
    category: '3D Solids',
    syntax: '\\(cylinder cx cy cz radius height [color] [fill=...] [width=...]\\)',
    description: 'Builds a segmented 3D vertical cylinder along the Y axis with circular top and bottom rims.',
    iso: true,
    exampleScript: `Drawing a 3D cylinder centered at x=400, y=380.
\\(axes 400 380 0 180 color=#475569 width=2\\)
\\(cylinder 400 380 0 80 170 #38bdf8 width=1.2 fill=rgba(56,189,248,0.14)\\)
\\(text 400 420 "Cylinder: r=80, h=170" 0 #38bdf8 font="18px sans-serif" align=center\\)`,
  },
  {
    name: 'cone',
    category: '3D Solids',
    syntax: '\\(cone cx cy cz radius height [color] [fill=...] [width=...]\\)',
    description: 'Constructs a curved 3D cone tapering from a circular XZ base to an apex at y - height.',
    iso: true,
    exampleScript: `Drawing a 3D cone tapering to its apex.
\\(axes 400 380 0 180 color=#475569 width=2\\)
\\(cone 400 380 0 85 180 #f59e0b width=1.2 fill=rgba(245,158,11,0.18)\\)
\\(text 400 420 "Cone: V = 1/3 π r² h" 0 #f59e0b font="18px sans-serif" align=center\\)`,
  },
  {
    name: 'axes',
    category: '3D Solids',
    syntax: '\\(axes ox oy [oz] length [color] [width=...]\\)',
    description: 'Draws 3 orthogonal arrows representing X, Y, and Z axes in 3D space.',
    iso: true,
    exampleScript: `Plotting 3D coordinate axes.
\\(axes 380 350 0 190 color=#38bdf8 width=2\\)
\\(text 580 355 "X" 0 #94a3b8 font="16px sans-serif"\\)
\\(text 375 150 "Y" 0 #94a3b8 font="16px sans-serif"\\)
\\(text 380 355 "Z" 205 #94a3b8 font="16px sans-serif"\\)`,
  },
  {
    name: 'circle / ellipse / arc',
    category: '2D & 3D Geometry',
    syntax: '\\(circle cx cy [cz] r [plane=xy|xz|yz] [fill=...]\\)',
    description: 'Animates circular or elliptical paths on any 3D plane (xy, xz, or yz).',
    iso: true,
    exampleScript: `Drawing orthogonal circles on XY and XZ planes.
\\(circle 400 300 0 110 #38bdf8 width=3 plane=xy fill=rgba(56,189,248,0.1)\\)
\\(circle 400 300 0 110 #f59e0b width=3 plane=xz\\)
\\(circle 400 300 0 110 #34d399 width=3 plane=yz\\)`,
  },
  {
    name: 'line / arrow',
    category: '2D & 3D Geometry',
    syntax: '\\(arrow x1 y1 [z1] x2 y2 [z2] [color] [head=12]\\)',
    description: 'Animates straight segments or directional vectors in 2D or 3D coordinates.',
    exampleScript: `Connecting points with a vector arrow.
\\(point 240 360 6 #94a3b8\\)
\\(arrow 240 360 540 200 #38bdf8 width=4 head=14\\)
\\(text 390 260 "Vector AB" #38bdf8 font="18px sans-serif" align=center\\)`,
  },
  {
    name: 'polygon / rect / triangle',
    category: '2D & 3D Geometry',
    syntax: '\\(polygon x1 y1 x2 y2 x3 y3 ... [3d] [fill=...]\\)',
    description: 'Draws closed shapes or open polylines in 2D or 3D (append 3d for xyz triples).',
    exampleScript: `Constructing a triangle and shaded square.
\\(polygon 260 380 420 380 260 200 #34d399 width=4 fill=rgba(52,211,153,0.18)\\)
\\(rect 460 220 140 140 #38bdf8 width=3 fill=rgba(56,189,248,0.15)\\)`,
  },
  {
    name: 'quadratic / bezier',
    category: 'Curves & Plots',
    syntax: '\\(bezier x0 y0 c1x c1y c2x c2y x1 y1 [color] [glow=...]\\)',
    description: 'Samples smooth quadratic or cubic Bézier curves for functions, waves, and trajectories.',
    exampleScript: `Tracing a smooth cubic wave curve.
\\(line 140 300 660 300 #475569 width=2\\)
\\(bezier 160 300 260 100 340 100 410 300 #38bdf8 width=4 glow=8\\)
\\(bezier 410 300 480 500 560 500 640 300 #f59e0b width=4 glow=8\\)`,
  },
  {
    name: 'grid',
    category: 'Curves & Plots',
    syntax: '\\(grid x y [z] cellSize rows cols [color]\\)',
    description: 'Draws an evenly spaced drafting grid for coordinate geometry lessons.',
    exampleScript: `Building a coordinate drafting grid.
\\(grid 200 140 40 8 10 color=#334155 width=1\\)
\\(circle 400 300 120 #38bdf8 width=3\\)`,
  },
  {
    name: 'text / highlight / bracket',
    category: 'Annotations & Flow',
    syntax: '\\(text x y "label" [z] [color] [font="20px sans-serif"] [align=center]\\)',
    description: 'Places crisp 3D-projected labels, glowing highlights, crosses, or measurement brackets.',
    exampleScript: `Annotating a diagram with text, highlight, and bracket.
\\(circle 400 300 75 #38bdf8 width=3\\)
\\(highlight 400 300 95 color=#facc15 glow=16\\)
\\(bracket 495 225 18 150 #94a3b8 width=2\\)
\\(text 525 305 "Diameter = 150" #facc15 font="17px sans-serif"\\)`,
  },
];

export const CommandDocs: React.FC<CommandDocsProps> = ({ onLoadIntoCanvas }) => {
  const [filter, setFilter] = useState<'All' | CommandItem['category']>('All');

  const visible =
    filter === 'All'
      ? COMMANDS
      : COMMANDS.filter((c) => c.category === filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            DrawScript 3D Command Reference
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            Every command supported by both the DrawScript Studio canvas and the embedded Chrome Extension engine.
            Style flags like <code className="font-mono text-slate-200">color=</code>,{' '}
            <code className="font-mono text-slate-200">fill=</code>,{' '}
            <code className="font-mono text-slate-200">width=</code>,{' '}
            <code className="font-mono text-slate-200">glow=</code>,{' '}
            <code className="font-mono text-slate-200">dash=</code>, and{' '}
            <code className="font-mono text-slate-200">1.5x</code> work across all shapes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg shrink-0">
          {(['All', '3D Solids', '2D & 3D Geometry', 'Curves & Plots', 'Annotations & Flow'] as const).map(
            (cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  filter === cat
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((cmd) => (
          <div
            key={cmd.name}
            className="flex flex-col justify-between p-5 rounded-xl bg-[#0F172A] border border-slate-800"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-base font-semibold font-mono text-sky-300">
                  {cmd.name}
                </h2>
                <span className="text-xs text-slate-400">{cmd.category}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed mb-3">
                {cmd.description}
              </p>
              <pre className="p-2.5 rounded-lg bg-[#030712] border border-slate-800 text-[11px] font-mono text-amber-300 overflow-x-auto whitespace-pre-wrap">
                {cmd.syntax}
              </pre>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() =>
                  onLoadIntoCanvas(cmd.exampleScript, `Command Example: ${cmd.name}`, cmd.iso)
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-sky-600 text-slate-100 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                Try on 3D Canvas
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
