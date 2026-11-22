import React, { useMemo, useState } from 'react';
import { Play, Search } from 'lucide-react';

interface CommandDocsProps {
  onLoadIntoCanvas: (script: string, sourceLabel: string, iso?: boolean) => void;
}

type Category =
  | '3D Solids'
  | '2D & 3D Geometry'
  | 'Curves & Plots'
  | 'Charts & Graphs'
  | 'Annotations & Flow'
  | 'Scene';

const CATEGORIES: readonly ('All' | Category)[] = [
  'All',
  '3D Solids',
  '2D & 3D Geometry',
  'Curves & Plots',
  'Charts & Graphs',
  'Annotations & Flow',
  'Scene',
];

interface CommandItem {
  name: string;
  category: Category;
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
    name: 'sphere',
    category: '3D Solids',
    syntax: '\\(sphere cx cy cz radius [lat=6] [lon=6] [color] [width=...]\\)',
    description: 'Draws a wireframe globe from latitude rings and longitude loops. Drag to orbit.',
    iso: true,
    exampleScript: `A wireframe sphere.
\\(axes 400 360 0 190 color=#334155 width=2\\)
\\(sphere 400 300 0 110 #38bdf8 width=1.4 lat=8 lon=8\\)
\\(text 400 440 "Sphere: V = 4/3 π r³" 0 #38bdf8 font="18px sans-serif" align=center\\)`,
  },
  {
    name: 'cube / box',
    category: '3D Solids',
    syntax: '\\(cube cx cy cz size [fill=...]\\)  \\(box cx cy cz width height depth [fill=...]\\)',
    description: 'Draws a cube or rectangular box centred on a point, with optional shaded faces.',
    iso: true,
    exampleScript: `A cube and a box.
\\(axes 400 380 0 190 color=#334155 width=2\\)
\\(cube 300 330 0 110 #f59e0b width=2 fill=rgba(245,158,11,0.15)\\)
\\(box 520 340 0 150 80 90 #34d399 width=2 fill=rgba(52,211,153,0.15)\\)`,
  },
  {
    name: 'pyramid',
    category: '3D Solids',
    syntax: '\\(pyramid cx cy cz baseSize height [fill=...]\\)',
    description: 'Draws a square pyramid whose base sits on the XZ plane and apex rises along Y.',
    iso: true,
    exampleScript: `A square pyramid.
\\(axes 400 380 0 190 color=#334155 width=2\\)
\\(pyramid 400 380 0 150 190 #f472b6 width=2 fill=rgba(244,114,182,0.15)\\)`,
  },
  {
    name: 'helix / spiral',
    category: 'Curves & Plots',
    syntax: '\\(helix cx cy cz radius height turns\\)  \\(spiral cx cy radius turns\\)',
    description: 'A 3D coil (helix) or a flat Archimedean spiral that grows from its centre.',
    iso: true,
    exampleScript: `A helix and a spiral.
\\(helix 280 400 0 60 220 5 #a78bfa width=3\\)
\\(spiral 540 300 110 4 #38bdf8 width=3\\)`,
  },
  {
    name: 'pentagon / hexagon / ngon',
    category: '2D & 3D Geometry',
    syntax: '\\(hexagon cx cy radius [rot=deg]\\)  \\(ngon cx cy radius sides\\)',
    description: 'Regular polygons. pentagon, hexagon, heptagon and octagon are shortcuts; ngon takes any side count.',
    exampleScript: `Regular polygons.
\\(pentagon 200 300 70 #38bdf8 width=3 fill=rgba(56,189,248,0.14)\\)
\\(hexagon 400 300 70 #34d399 width=3 fill=rgba(52,211,153,0.14)\\)
\\(ngon 600 300 70 9 #f59e0b width=3 fill=rgba(245,158,11,0.14)\\)`,
  },
  {
    name: 'star',
    category: '2D & 3D Geometry',
    syntax: '\\(star cx cy outerRadius innerRadius [points=5] [rot=deg]\\)',
    description: 'A star polygon. A smaller inner radius makes sharper points.',
    exampleScript: `Stars with different point counts.
\\(star 250 300 90 38 5 gold width=3 fill=rgba(250,204,21,0.15)\\)
\\(star 540 300 90 55 8 #f472b6 width=3\\)`,
  },
  {
    name: 'doublearrow',
    category: '2D & 3D Geometry',
    syntax: '\\(doublearrow x1 y1 [z1] x2 y2 [z2] [head=12]\\)',
    description: 'Like arrow, with an arrowhead at both ends. Good for distances and ranges.',
    exampleScript: `A two-way arrow.
\\(doublearrow 200 300 600 300 #38bdf8 width=3 head=14\\)
\\(text 400 270 "distance" #38bdf8 font="18px sans-serif" align=center\\)`,
  },
  {
    name: 'axes2d',
    category: 'Charts & Graphs',
    syntax: '\\(axes2d originX originY scale xmin xmax ymin ymax [grid] [step=1] [labels=off]\\)',
    description: 'Labelled 2D axes with tick marks and arrowheads. Pair with plot using the same origin and scale.',
    exampleScript: `Axes with a grid.
\\(axes2d 400 300 40 -8 8 -4 4 #94a3b8 grid\\)`,
  },
  {
    name: 'plot',
    category: 'Charts & Graphs',
    syntax: '\\(plot "expression" xmin xmax [originX originY scale] [color]\\)',
    description: 'Graphs any f(x). Supports + - * / ^ %, pi, e, sin cos tan sqrt abs ln log exp and more. Breaks the line at asymptotes.',
    exampleScript: `Plotting sin(x) and x²/4.
\\(axes2d 400 300 40 -8 8 -4 4 #94a3b8 grid\\)
\\(plot "sin(x)" -8 8 400 300 40 #38bdf8 width=4\\)
\\(plot "x^2/4" -4 4 400 300 40 #f59e0b width=4\\)`,
  },
  {
    name: 'pie',
    category: 'Charts & Graphs',
    syntax: '\\(pie cx cy radius value1 value2 ... [start=-90] [labels=off]\\)',
    description: 'A pie chart with auto-coloured slices and percentage labels.',
    exampleScript: `A pie chart.
\\(pie 400 300 130 40 25 20 15 #ffffff width=2\\)`,
  },
  {
    name: 'bars',
    category: 'Charts & Graphs',
    syntax: '\\(bars x y barWidth maxHeight value1 value2 ... [gap=...] [values=off]\\)',
    description: 'A bar chart. The tallest value fills maxHeight; each bar gets its own colour and value label.',
    exampleScript: `A bar chart.
\\(bars 230 440 60 260 12 30 22 40 18 #ffffff width=2\\)`,
  },
  {
    name: 'numberline',
    category: 'Charts & Graphs',
    syntax: '\\(numberline x y length min max [step=1]\\)',
    description: 'A horizontal number line with tick marks and labels.',
    exampleScript: `A number line from -5 to 5.
\\(numberline 150 300 500 -5 5 step=1 #94a3b8 width=2\\)
\\(point 400 300 7 #38bdf8\\)`,
  },
  {
    name: 'angle',
    category: 'Annotations & Flow',
    syntax: '\\(angle cx cy radius startDeg endDeg ["θ"] [rays] [square]\\)',
    description: 'Draws an angle arc (degrees, counter-clockwise), with optional rays, a right-angle square and a label.',
    exampleScript: `Marking angles.
\\(angle 300 350 70 0 50 "θ" rays #facc15 width=3\\)
\\(angle 560 350 50 90 180 square #ffffff width=2\\)`,
  },
  {
    name: 'dimension',
    category: 'Annotations & Flow',
    syntax: '\\(dimension x1 y1 x2 y2 "label" [offset=24]\\)',
    description: 'An engineering-style measurement line with extension lines, arrowheads and a label. Negative offset flips the side.',
    exampleScript: `Measuring a side.
\\(rect 250 220 300 160 #94a3b8 width=3\\)
\\(dimension 250 380 550 380 "300 px" offset=30 #38bdf8\\)
\\(dimension 250 220 250 380 "160 px" offset=-30 #34d399\\)`,
  },
  {
    name: 'background',
    category: 'Scene',
    syntax: '\\(background #0f172a\\)',
    description: 'Changes the canvas background colour. It resets to the default on every run.',
    exampleScript: `Changing the background.
\\(background #1e1b4b\\)
\\(circle 400 300 100 #a78bfa width=4\\)`,
  },
  {
    name: 'camera',
    category: 'Scene',
    syntax: '\\(camera iso | front | reset | yaw=deg pitch=deg zoom=1.5 [duration=1]\\)',
    description: 'Smoothly moves the 3D camera as part of the script, so a lesson can rotate to show a solid from a new angle.',
    iso: true,
    exampleScript: `A camera move.
\\(cube 400 320 0 140 #f59e0b width=2 fill=rgba(245,158,11,0.15)\\)
Now let us look from the front.
\\(camera front duration=1\\)
Back to the angled view, zoomed in.
\\(camera iso zoom=1.3 duration=1.2\\)`,
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
  const [filter, setFilter] = useState<'All' | Category>('All');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return COMMANDS.filter((c) => {
      if (filter !== 'All' && c.category !== filter) return false;
      if (!q) return true;
      return (
        c.name.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q) ||
        c.syntax.toLowerCase().includes(q)
      );
    });
  }, [filter, query]);

  return (
    <div className="space-y-6">
      <div className="space-y-4 border-b border-slate-800 pb-5">
        <div className="max-w-3xl">
          <h1 className="text-2xl font-semibold text-white tracking-tight">
            DrawScript 3D Command Reference
          </h1>
          <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">
            {COMMANDS.length} commands, supported by both the DrawScript Studio canvas and the embedded Chrome Extension engine.
            Style flags like <code className="font-mono text-slate-200">color=</code>,{' '}
            <code className="font-mono text-slate-200">fill=</code>,{' '}
            <code className="font-mono text-slate-200">width=</code>,{' '}
            <code className="font-mono text-slate-200">glow=</code>,{' '}
            <code className="font-mono text-slate-200">dash=</code>, and{' '}
            <code className="font-mono text-slate-200">1.5x</code> work across all shapes.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <label className="relative block w-full lg:w-72 shrink-0">
            <span className="sr-only">Search commands</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search commands…"
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
            />
          </label>

          <div
            role="tablist"
            aria-label="Command categories"
            className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg overflow-x-auto max-w-full"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                role="tab"
                aria-selected={filter === cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  filter === cat
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </div>

      {visible.length === 0 && (
        <p className="py-12 text-center text-sm text-slate-500">
          No commands match “{query}”. Try a different word or category.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visible.map((cmd) => (
          <div
            key={cmd.name}
            className="flex flex-col justify-between p-5 rounded-xl bg-[#0F172A] border border-slate-800 hover:border-slate-700 transition-colors"
          >
            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <h2 className="text-base font-semibold font-mono text-sky-300 break-words min-w-0">
                  {cmd.name}
                </h2>
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">{cmd.category}</span>
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
