export interface LessonPreset {
  id: string;
  title: string;
  subject: string;
  description: string;
  isoView?: boolean;
  script: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a visual educator inside DrawScript 3D.
Explain the user's question with brief, friendly spoken narration interleaved with DrawScript drawing commands wrapped strictly in \\( ... \\).

COORDINATE SYSTEM:
- Virtual 3D drafting canvas centered at x=400, y=300, z=0.
- Visible 2D area: x from 100 to 700, y from 80 to 520.
- Use z values (-150 to +150) for true 3D depth, axes, cones, and cylinders.

AVAILABLE COMMANDS (wrap each inside \\( and \\)):
- \\(grid x y cellSize rows cols color=#1e293b width=1\\)
- \\(axes ox oy oz length color=#94a3b8 width=2\\)
- \\(line x1 y1 x2 y2 color width=4\\) or 3D: \\(line x1 y1 z1 x2 y2 z2 color\\)
- \\(arrow x1 y1 z1 x2 y2 z2 color width=3 head=12\\)
- \\(circle cx cy [cz] radius color fill=rgba(...) plane=xy|xz|yz\\)
- \\(ellipse cx cy [cz] rx ry color plane=xy|xz|yz\\)
- \\(arc cx cy [cz] radius startRad endRad color\\)
- \\(rect x y [z] width height color fill=rgba(...)\\)
- \\(triangle x1 y1 x2 y2 x3 y3 color fill=rgba(...)\\)
- \\(polygon x1 y1 x2 y2 ... color fill=rgba(...)\\)
- \\(quadratic x0 y0 cx cy x1 y1 color width=3\\)
- \\(bezier x0 y0 c1x c1y c2x c2y x1 y1 color\\)
- \\(cylinder cx cy cz radius height color fill=rgba(...)\\)
- \\(cone cx cy cz radius height color fill=rgba(...)\\)
- \\(point x y [z] radius color\\)
- \\(text x y "label" [z] color font="20px sans-serif" align=center\\)
- \\(highlight x y [z] radius color=yellow glow=16\\)
- \\(doublearrow x1 y1 x2 y2 color width=3\\)  (arrowheads on both ends)
- \\(pentagon|hexagon|heptagon|octagon cx cy radius color fill=rgba(...) rot=15\\)
- \\(ngon cx cy radius sides color\\)  and  \\(star cx cy outerR innerR [points] color\\)
- \\(sphere cx cy cz radius color lat=6 lon=6\\)  (wireframe globe)
- \\(cube cx cy cz size color fill=rgba(...)\\)  and  \\(box cx cy cz width height depth color\\)
- \\(pyramid cx cy cz baseSize height color fill=rgba(...)\\)
- \\(helix cx cy cz radius height turns color\\)  and  \\(spiral cx cy radius turns color\\)
- \\(axes2d originX originY scale xmin xmax ymin ymax color grid step=1\\)  (labelled 2D axes with ticks)
- \\(plot "sin(x)/x" xmin xmax originX originY scale color width=3\\)  (graphs any f(x); supports sin cos tan sqrt abs ln log exp pi ^)
- \\(numberline x y length min max step=1 color\\)
- \\(pie cx cy radius v1 v2 v3 ...\\)  (auto-coloured slices with % labels)
- \\(bars x y barWidth maxHeight v1 v2 v3 ...\\)  (auto-coloured bar chart with value labels)
- \\(angle cx cy radius startDeg endDeg "θ" rays color\\)  (add "square" for a right-angle mark)
- \\(dimension x1 y1 x2 y2 "label" offset=-24 color\\)  (measurement line with end arrows)
- \\(camera iso | front | yaw=30 pitch=20 zoom=1.5 duration=1\\)  (animated camera move)
- \\(background #0f172a\\)
- \\(wait 0.6\\)

RULES:
1. Never put Markdown formatting inside \\( ... \\).
2. Always quote multi-word text strings in text commands: \\(text 400 90 "Pythagorean Theorem" cyan\\).
3. Narrate one concept at a time, then immediately draw the matching geometry.
4. Keep coordinates well-spaced so labels never overlap.
5. Prefer plot, axes2d, pie, bars, angle and dimension over hand-built lines when teaching graphs, statistics or geometry.
6. Put each command on its own line, wrapped in its own \\( ... \\). Never put several commands inside one \\( ... \\) and never separate them with spaces on one line.
7. Never use $ or $$ around commands, and never put commands in a code block; those are only for real math formulas.`;

export const LESSON_PRESETS: LessonPreset[] = [
  {
    id: 'pythagorean',
    title: 'Pythagorean Theorem (a² + b² = c²)',
    subject: 'Geometry',
    description: 'Constructs a 3-4-5 right triangle, appends squares onto legs a and b, and highlights the hypotenuse square c².',
    script: `Let us explore the Pythagorean theorem visually.
\\(grid 160 80 40 11 12 color=#1e293b width=1 opacity=0.6\\)
First, we draw a right triangle with base a equals 3 units and height b equals 4 units.
\\(polygon 320 380 440 380 320 220 #38bdf8 width=4 fill=rgba(56,189,248,0.14)\\)
\\(rect 320 356 24 24 #94a3b8 width=2\\)
\\(text 380 408 "a = 3" #38bdf8 font="18px sans-serif" align=center\\)
\\(text 294 300 "b = 4" #34d399 font="18px sans-serif" align=center\\)
\\(text 400 288 "c = 5" #f59e0b font="18px sans-serif" align=center\\)
Now let us build the square on side a, with area 3 squared equals 9.
\\(rect 320 380 120 120 #38bdf8 width=3 fill=rgba(56,189,248,0.18)\\)
\\(text 380 446 "a² = 9" #e0f2fe font="18px sans-serif" align=center\\)
Next, build the square on side b, with area 4 squared equals 16.
\\(rect 160 220 160 160 #34d399 width=3 fill=rgba(52,211,153,0.18)\\)
\\(text 240 306 "b² = 16" #d1fae5 font="18px sans-serif" align=center\\)
Finally, the square on the hypotenuse c has area 9 plus 16 equals 25!
\\(polygon 320 220 440 380 600 260 480 100 #f59e0b width=3 fill=rgba(245,158,11,0.2)\\)
\\(text 460 245 "c² = 25" #fef3c7 font="20px sans-serif" align=center glow=10\\)
\\(highlight 460 240 90 color=#f59e0b glow=18\\)
\\(text 400 54 "a² + b² = c²  →  9 + 16 = 25" #ffffff font="22px sans-serif" align=center\\)`,
  },
  {
    id: 'cone-cylinder',
    title: '3D Cone & Cylinder Volume (1 : 3)',
    subject: '3D Solid Geometry',
    description: 'Uses true 3D primitives to compare a cylinder and cone of equal radius and height. Drag to orbit in 3D.',
    isoView: true,
    script: `Let us compare a 3D cylinder and a 3D cone that share the exact same radius and height.
\\(axes 400 380 0 210 color=#475569 width=2\\)
On the left, we construct our reference cylinder of radius r and height h.
\\(cylinder 270 380 0 70 160 #38bdf8 width=1.2 fill=rgba(56,189,248,0.12)\\)
\\(text 270 422 "V = π r² h" 0 #38bdf8 font="18px sans-serif" align=center\\)
On the right, we build a cone with the exact same circular base and height h.
\\(cone 530 380 0 70 160 #f59e0b width=1.2 fill=rgba(245,158,11,0.16)\\)
\\(text 530 422 "V = ⅓ π r² h" 0 #f59e0b font="18px sans-serif" align=center\\)
Because the cone tapers linearly to a single apex, it holds exactly one third the volume of the cylinder.
\\(arrow 360 300 0 440 300 0 #e2e8f0 width=3 head=10\\)
\\(text 400 282 "3× cones = 1 cylinder" 0 #ffffff font="16px sans-serif" align=center\\)
Drag anywhere on the canvas to orbit around both 3D solids!`,
  },
  {
    id: 'projectile',
    title: 'Projectile Motion & Velocity Vectors',
    subject: 'Physics',
    description: 'Plots a parabolic trajectory using quadratic Bézier curves and decomposes horizontal and vertical velocity.',
    script: `Let us visualize projectile motion launched at an angle.
\\(line 120 440 680 440 #64748b width=3\\)
\\(line 120 440 120 120 #64748b width=3\\)
\\(text 670 465 "x (distance)" #94a3b8 font="14px sans-serif" align=right\\)
\\(text 132 135 "y (height)" #94a3b8 font="14px sans-serif" align=left\\)
We launch from the origin with initial velocity vector v naught.
\\(arrow 120 440 215 290 #38bdf8 width=4 head=12\\)
\\(text 195 340 "v₀" #38bdf8 font="18px sans-serif" align=left\\)
Gravity pulls downward, shaping the flight into a symmetric parabola.
\\(quadratic 120 440 400 40 660 440 #f59e0b width=4 glow=8\\)
At the highest point, vertical velocity reaches zero while horizontal velocity stays constant.
\\(point 390 240 7 #facc15\\)
\\(highlight 390 240 28 color=#facc15 glow=14\\)
\\(arrow 390 240 475 240 #34d399 width=3 head=10\\)
\\(text 390 202 "Apex: vy = 0, vx = const" #fef08a font="16px sans-serif" align=center\\)
\\(arrow 400 85 400 145 #f43f5e width=3 head=10\\)
\\(text 414 120 "g = -9.8 m/s²" #fda4af font="15px sans-serif" align=left\\)`,
  },
  {
    id: 'vectors-3d',
    title: '3D Vector Addition (u + v = w)',
    subject: 'Linear Algebra',
    description: 'Demonstrates tip-to-tail vector addition in three dimensions using X, Y, and Z axes.',
    isoView: true,
    script: `Let us add two vectors u and v in 3D space.
\\(axes 360 360 0 210 color=#475569 width=2\\)
\\(text 580 365 "X" 0 #94a3b8 font="15px sans-serif"\\)
\\(text 354 140 "Y" 0 #94a3b8 font="15px sans-serif"\\)
\\(text 360 365 "Z" 220 #94a3b8 font="15px sans-serif"\\)
First, draw vector u from the origin into positive X and Y.
\\(arrow 360 360 0 490 270 40 #38bdf8 width=4 head=12\\)
\\(text 435 295 "u" 20 #38bdf8 font="18px sans-serif"\\)
Next, place the tail of vector v at the tip of u, extending along Z and Y.
\\(arrow 490 270 40 530 190 150 #34d399 width=4 head=12\\)
\\(text 525 220 "v" 100 #34d399 font="18px sans-serif"\\)
Finally, the resultant vector w connects the origin directly to the tip of v.
\\(arrow 360 360 0 530 190 150 #f59e0b width=4 head=14 glow=8\\)
\\(text 425 250 "w = u + v" 80 #fcd34d font="18px sans-serif"\\)
\\(point 530 190 150 6 #f59e0b\\)`,
  },
  {
    id: 'function-plot',
    title: 'Graphing Functions (sin x, x², 1/x)',
    subject: 'Algebra & Calculus',
    description: 'Uses axes2d and plot to graph several functions from plain math expressions.',
    script: `Let us graph some classic functions on one set of axes.
\\(axes2d 400 300 40 -7 7 -4 4 #94a3b8 grid\\)
First, the sine wave, which repeats every two pi.
\\(plot "sin(x)" -7 7 400 300 40 #38bdf8 width=4 glow=6\\)
\\(text 640 190 "y = sin(x)" #38bdf8 font="16px sans-serif" align=left\\)
Next, a parabola, which opens upward and has its vertex at the origin.
\\(plot "x^2/4" -4 4 400 300 40 #f59e0b width=4\\)
\\(text 560 110 "y = x²/4" #f59e0b font="16px sans-serif" align=left\\)
Finally, the reciprocal function, which blows up near zero.
\\(plot "1/x" -7 7 400 300 40 #34d399 width=4\\)
\\(text 470 190 "y = 1/x" #34d399 font="16px sans-serif" align=left\\)`,
  },
  {
    id: 'solids-3d',
    title: '3D Solids Gallery',
    subject: '3D Solid Geometry',
    description: 'A sphere, cube and pyramid side by side, drawn with the new solid primitives. Drag to orbit.',
    isoView: true,
    script: `Let us tour three classic solids.
\\(axes 400 400 0 200 color=#334155 width=2\\)
A sphere is every point at the same distance from its centre.
\\(sphere 220 330 0 75 #38bdf8 width=1.5 lat=7 lon=7\\)
\\(text 220 440 "Sphere" 0 #38bdf8 font="18px sans-serif" align=center\\)
A cube has six equal square faces, twelve edges and eight vertices.
\\(cube 400 350 0 120 #f59e0b width=2 fill=rgba(245,158,11,0.14)\\)
\\(text 400 440 "Cube" 0 #f59e0b font="18px sans-serif" align=center\\)
A square pyramid rises from a square base to a single apex.
\\(pyramid 590 400 0 130 170 #f472b6 width=2 fill=rgba(244,114,182,0.14)\\)
\\(text 590 440 "Pyramid" 0 #f472b6 font="18px sans-serif" align=center\\)
Drag the canvas to orbit around them.`,
  },
  {
    id: 'right-angle',
    title: 'Angles & Measurements',
    subject: 'Geometry',
    description: 'Shows right-angle marks, labelled angles and dimension lines on a triangle.',
    script: `Let us label a right triangle properly.
\\(polygon 220 420 520 420 520 220 #94a3b8 width=3 fill=rgba(148,163,184,0.08)\\)
The corner at the bottom right is a right angle.
\\(angle 520 420 50 90 180 square #facc15 width=2\\)
The angle at the bottom left is theta.
\\(angle 220 420 70 0 34 "θ" #38bdf8 width=3\\)
Now we measure the base and the height with dimension lines.
\\(dimension 220 420 520 420 "base = 300" offset=-34 #34d399\\)
\\(dimension 520 420 520 220 "height = 200" offset=-34 #f59e0b\\)
\\(text 340 300 "hypotenuse" #94a3b8 font="16px sans-serif" align=center\\)`,
  },
  {
    id: 'charts',
    title: 'Data: Pie & Bar Charts',
    subject: 'Statistics',
    description: 'Presents the same data as a pie chart and a bar chart using auto-coloured charts.',
    script: `Here is how a class spent its study time, shown two ways.
\\(text 400 60 "Study time by subject" #ffffff font="22px sans-serif" align=center\\)
First as a pie chart, where each slice is its share of the total.
\\(pie 230 290 120 40 25 20 15 #ffffff width=2\\)
Now the same numbers as a bar chart, where height shows the amount.
\\(bars 440 410 50 240 40 25 20 15 #ffffff width=2\\)
\\(numberline 120 500 560 0 100 step=10 #64748b\\)`,
  },
];

export const SIMULATED_CHATGPT_REPLY = `Sure! Here is a visual explanation of the **Unit Circle & Sine Wave** in DrawScript 3D:

Let us start by drawing the unit circle on the left side of our stage.
\\(circle 230 300 100 #38bdf8 width=3 fill=rgba(56,189,248,0.12)\\)
\\(line 110 300 350 300 #475569 width=2\\)
\\(line 230 180 230 420 #475569 width=2\\)

Now mark an angle theta at 45 degrees and project its vertical height onto the sine axis.
\\(arrow 230 300 301 229 #f59e0b width=4 head=10\\)
\\(point 301 229 6 #facc15\\)
\\(line 301 229 301 300 #34d399 width=3 dash=6,4\\)
\\(text 314 268 "sin(θ)" #34d399 font="16px sans-serif"\\)

Now watch how that vertical height maps across time to trace a smooth sine wave on the right.
\\(line 380 300 680 300 #475569 width=2\\)
\\(line 380 180 380 420 #475569 width=2\\)
\\(bezier 380 300 430 140 480 140 530 300 #34d399 width=4\\)
\\(bezier 530 300 580 460 630 460 680 300 #34d399 width=4\\)
\\(text 530 165 "y = sin(θ)" #a7f3d0 font="18px sans-serif" align=center\\)`;
