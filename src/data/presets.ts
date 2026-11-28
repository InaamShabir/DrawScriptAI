export interface LessonPreset {
  id: string;
  title: string;
  subject: string;
  description: string;
  isoView?: boolean;
  script: string;
}

export const DEFAULT_SYSTEM_PROMPT = `You are a brilliant, warm teacher inside DrawScript 3D. Your job is to make the student truly UNDERSTAND, not just see the answer. Your whole reply is a narrated, animated lesson: spoken sentences interleaved with drawing commands, each command wrapped strictly in \\( ... \\).

HOW TO TEACH (follow this every time):
1. Hook: restate the question in one friendly sentence and draw the situation with every given value labelled.
2. Big idea: name the one or two principles that solve it, in plain words. An everyday analogy helps.
3. Step by step: ONE idea per screen. For each step say what we are doing and WHY, then draw it. Reveal equations one line at a time, with real numbers.
4. Show motion: when something moves, changes or flows, animate it (name the object, then move / fade / recolor / pulse it). Never describe motion in words only.
5. Check: for multiple-choice questions, say why each wrong option is wrong.
6. Takeaway: finish with a one-line shortcut and the most common trap.
Use 6 to 10 screens. Be encouraging and conversational ("Notice that...", "Here is the key trick...").

NARRATION RULES:
- 2 to 4 short sentences per screen, written to be spoken aloud. Explain the reason behind every step.
- Refer to what is visible ("look at the orange block").
- In narration write words, not symbols ("mass times g times height"); keep symbols and numbers in the drawings.
- After \\(clear\\) and \\(title\\), alternate: one sentence, then the drawing it talks about.

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
- \\(clear\\)  (wipe the screen; start every new idea with it)
- \\(title "Short screen title" [color]\\)  (centered heading, use on every screen)
- \\(incline x y width height color [flip]\\)  (right-triangle slope with angle label; x,y is the bottom-left corner)
- \\(ground x y length color [rough]\\)  (floor line with hatching; add rough for friction surfaces)
- \\(block cx cy size "label" color\\)  (labelled box centred on cx cy)

MOTION AND EMPHASIS (what makes lessons come alive):
- Add name=thing to ANY drawing command, e.g. \\(circle 160 234 14 orange fill=rgba(249,115,22,0.9) name=ball\\). Several commands may share one name.
- \\(move ball dx dy duration=2.5\\)  slides everything named ball by (dx, dy)
- \\(fade ball duration=1\\)  fades it out;  \\(fade ball to=0.3\\) dims it
- \\(recolor ball red\\)   \\(pulse ball\\)  (blink to draw attention)   \\(remove ball\\)

DRAWING RULES:
1. Put your ENTIRE reply inside ONE fenced code block labeled \`\`\`drawscript so the DrawScript Chrome Extension can read and render it. Write nothing outside that block.
2. Inside the block, write narration sentences and drawing commands. Put every command on its own line, wrapped in its own \\( ... \\). Never put several commands inside one \\( ... \\). Do not use $ and no Markdown formatting inside the block.
3. Every screen starts with \\(clear\\) then \\(title "..."\\). Keep at most 10 shapes and labels per screen.
4. Make diagrams LARGE and centred: fill most of x 100-700, y 150-500. Blocks, balls and points should be at least 24 units wide; text at least 16px.
5. Never let labels overlap. Quote every text string: \\(text 400 300 "KE = 100 J" yellow font="22px sans-serif" align=center\\). Use y 150-500 for content; y 108 belongs to the title.
6. Use a consistent colour code through the lesson (for example orange = the object, blue = surfaces, yellow = energy, red = losses, green = final answer).
7. Arguments are strictly positional, then key=value. Examples: \\(dimension x1 y1 x2 y2 "5 m" offset=-30 yellow\\)  \\(arrow x1 y1 z1 x2 y2 z2 color width=4\\)  \\(line x1 y1 x2 y2 color width=3\\).
8. Prefer incline, ground, block, plot, axes2d, pie, bars, angle and dimension over hand-built shapes.

EXAMPLE OF THE STYLE (a different topic, shortened):
\`\`\`drawscript
\\(clear\\)
\\(title "A Falling Ball Trades Height for Speed"\\)
Let us find out why a dropped ball speeds up. We will follow its energy.
\\(ground 250 470 300 #94a3b8\\)
\\(circle 400 190 22 #f59e0b fill=rgba(245,158,11,0.9) name=ball\\)
\\(dimension 340 190 340 470 "h = 5 m" offset=-30 #facc15\\)
At the top the ball is still, so all its energy is stored height energy. Think of it as money in a bank.
\\(text 560 220 "At the top: PE = mgh" #facc15 font="20px sans-serif" align=center\\)
\\(pulse ball\\)
As it falls, the bank slowly pays out as speed. Watch the ball and the energy bars.
\\(rect 520 260 60 180 #facc15 fill=rgba(250,204,21,0.5) name=pe\\)
\\(move ball 0 258 duration=2\\)
\\(fade pe duration=1.2\\)
\\(rect 620 260 60 180 #4ade80 fill=rgba(74,222,128,0.5)\\)
The same amount of energy is now movement energy. Nothing was lost, it only changed form.
\`\`\``;

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
  {
    id: 'neet-energy-friction',
    title: 'NEET: Work, Energy & Friction on Slopes',
    subject: 'Physics',
    description: 'A full teacher-style lesson: a block slides down a smooth slope, crosses a rough floor and climbs again. Uses named objects, motion, an energy ledger and an option check.',
    script: `\\(clear\\)
\\(title "The Journey of the Block"\\)
Here is a classic NEET problem. A 2 kilogram block slides down a smooth slope that is 5 metres high, crosses a rough floor 10 metres long, and then climbs a second smooth slope.
\\(incline 130 400 220 170 #38bdf8\\)
\\(ground 350 400 180 #f97316 rough\\)
\\(incline 530 400 150 140 #38bdf8 flip\\)
\\(circle 158 234 14 #f59e0b fill=rgba(245,158,11,0.9) name=blk\\)
\\(text 158 204 "2 kg" #fbbf24 font="16px sans-serif" align=center name=blk\\)
We want to know how high it gets. First, let us picture the whole journey.
\\(dimension 108 230 108 400 "5 m" offset=-32 #facc15\\)
\\(text 195 372 "smooth" #7dd3fc font="16px sans-serif" align=center\\)
\\(text 440 440 "rough floor, μ = 0.2, 10 m" #fb923c font="16px sans-serif" align=center\\)
\\(text 628 385 "smooth" #7dd3fc font="16px sans-serif" align=center\\)
\\(pulse blk\\)
\\(clear\\)
\\(title "Two Rules of the Game"\\)
Before any calculation, remember just two rules. On a smooth surface nothing steals energy, so it only changes form, from stored height energy to movement energy and back.
\\(rect 120 170 260 230 #22c55e fill=rgba(34,197,94,0.10) width=3\\)
\\(text 250 210 "SMOOTH" #4ade80 font="24px sans-serif" align=center\\)
\\(text 250 260 "No energy lost" white font="19px sans-serif" align=center\\)
\\(text 250 300 "PE ⇄ KE" #facc15 font="28px sans-serif" align=center\\)
\\(text 250 350 "energy just changes form" #94a3b8 font="15px sans-serif" align=center\\)
On a rough surface, friction steals some energy and turns it into heat. The whole problem is bookkeeping: how much energy do we start with, and how much does friction take away?
\\(rect 420 170 260 230 #f97316 fill=rgba(249,115,22,0.10) width=3\\)
\\(text 550 210 "ROUGH" #fb923c font="24px sans-serif" align=center\\)
\\(text 550 260 "Friction takes energy" white font="19px sans-serif" align=center\\)
\\(text 550 300 "W = − f × d" #f87171 font="28px sans-serif" align=center\\)
\\(text 550 350 "energy leaves as heat" #94a3b8 font="15px sans-serif" align=center\\)
\\(clear\\)
\\(title "Start: all energy is height energy"\\)
Step one: how much energy do we start with? The block is at rest at the top, so it has no movement energy.
\\(incline 130 400 220 170 #38bdf8\\)
\\(circle 158 234 14 #f59e0b fill=rgba(245,158,11,0.9) name=blk\\)
\\(dimension 108 230 108 400 "h = 5 m" offset=-40 #facc15\\)
\\(text 560 200 "At the top" #94a3b8 font="17px sans-serif" align=center\\)
All of its energy is stored as height energy, which is mass times g times height. That is 2 times 10 times 5, which gives 100 joules.
\\(text 560 240 "v = 0, so KE = 0" white font="20px sans-serif" align=center\\)
\\(text 560 290 "PE = m g h" #facc15 font="22px sans-serif" align=center\\)
\\(text 560 330 "= 2 × 10 × 5" white font="22px sans-serif" align=center\\)
\\(text 560 380 "= 100 J" #4ade80 font="30px sans-serif" align=center\\)
\\(pulse blk\\)
\\(clear\\)
\\(title "Smooth slope: 100 J just changes form"\\)
Now let it go. The first slope is smooth, so nothing is lost on the way down.
\\(incline 130 400 220 170 #38bdf8\\)
\\(circle 158 234 14 #f59e0b fill=rgba(245,158,11,0.9) name=blk\\)
\\(move blk 192 152 duration=2.6\\)
\\(rect 470 190 70 200 #334155 fill=rgba(51,65,85,0.3) width=2\\)
\\(rect 470 190 70 200 #facc15 fill=rgba(250,204,21,0.55) width=2 name=pe\\)
The height energy turns into movement energy, and at the bottom the block still holds exactly 100 joules, all of it now movement energy.
\\(text 505 175 "PE 100 J" #facc15 font="16px sans-serif" align=center\\)
\\(wait 0.4\\)
\\(fade pe duration=1.2\\)
\\(rect 580 190 70 200 #4ade80 fill=rgba(74,222,128,0.55) width=2\\)
\\(text 615 175 "KE 100 J" #4ade80 font="16px sans-serif" align=center\\)
\\(text 560 430 "Nothing lost on a smooth slope" #94a3b8 font="16px sans-serif" align=center\\)
\\(clear\\)
\\(title "Rough floor: friction acts backwards"\\)
Here comes the important part. On the rough floor, friction pushes backwards the whole time the block moves forward, so it does negative work. First find the friction force.
\\(ground 150 340 500 #f97316 rough\\)
\\(circle 230 326 14 #f59e0b fill=rgba(245,158,11,0.9) name=blk\\)
\\(arrow 230 326 0 330 326 0 #38bdf8 width=4 name=blk\\)
\\(text 330 310 "motion" #7dd3fc font="15px sans-serif" align=center name=blk\\)
\\(arrow 216 326 0 156 326 0 #ef4444 width=4 name=blk\\)
The floor pushes up with the normal force, which equals the weight, mg, so 20 newtons. Friction is mu times that, which is 0.2 times 20, so 4 newtons.
\\(text 150 300 "friction f" #f87171 font="15px sans-serif" align=center name=blk\\)
\\(move blk 360 0 duration=3\\)
\\(dimension 230 378 590 378 "10 m" offset=0 #facc15\\)
\\(text 400 420 "N = mg = 2 × 10 = 20 N" white font="21px sans-serif" align=center\\)
\\(text 400 460 "f = μN = 0.2 × 20 = 4 N" #fb923c font="23px sans-serif" align=center\\)
\\(clear\\)
\\(title "How much energy did friction take?"\\)
Work done by friction is the force times the distance, but with a minus sign, because friction points opposite to the motion. So work is minus 4 times 10, which is minus 40 joules.
\\(text 400 200 "W = − f × d" #94a3b8 font="26px sans-serif" align=center\\)
\\(text 400 260 "W = − 4 × 10" white font="30px sans-serif" align=center\\)
Friction has just removed 40 joules of energy, and it will never give it back.
\\(text 400 335 "W = − 40 J" #f87171 font="40px sans-serif" align=center\\)
\\(text 400 410 "40 J leaves as heat" #94a3b8 font="18px sans-serif" align=center\\)
\\(clear\\)
\\(title "The Energy Ledger"\\)
Let us put the energy on a ledger. At the top there was 100 joules. At the bottom of the first slope, still 100.
\\(line 120 440 690 440 #64748b width=2\\)
\\(rect 150 240 70 200 #facc15 fill=rgba(250,204,21,0.55) width=2\\)
\\(text 185 225 "100 J" #facc15 font="18px sans-serif" align=center\\)
\\(text 185 465 "Top" white font="16px sans-serif" align=center\\)
\\(rect 270 240 70 200 #4ade80 fill=rgba(74,222,128,0.55) width=2\\)
\\(text 305 225 "100 J" #4ade80 font="18px sans-serif" align=center\\)
After the rough patch we have 100 minus 40, which is 60 joules left. And 60 joules is exactly what will be available to climb the second slope.
\\(text 305 465 "Bottom" white font="16px sans-serif" align=center\\)
\\(rect 390 320 70 120 #4ade80 fill=rgba(74,222,128,0.55) width=2\\)
\\(rect 390 240 70 80 #ef4444 fill=rgba(239,68,68,0.45) width=2 dash=5,4\\)
\\(text 425 225 "60 J left" #4ade80 font="18px sans-serif" align=center\\)
\\(text 425 465 "After rough" white font="16px sans-serif" align=center\\)
\\(text 560 280 "− 40 J" #f87171 font="22px sans-serif" align=center\\)
\\(text 560 310 "lost as heat" #f87171 font="15px sans-serif" align=center\\)
\\(clear\\)
\\(title "Second slope: climb until KE = 0"\\)
Finally the block reaches the second smooth slope. It climbs until it stops for a moment, and at that highest point all of its remaining 60 joules has turned back into height energy.
\\(incline 530 400 150 140 #38bdf8 flip\\)
\\(ground 120 400 410 #f97316 rough\\)
\\(circle 520 386 14 #f59e0b fill=rgba(245,158,11,0.9) name=blk\\)
\\(text 520 356 "60 J" #4ade80 font="16px sans-serif" align=center name=blk\\)
\\(move blk 109 -102 duration=2.6\\)
So 60 equals m g h, which is 2 times 10 times h, and h equals 60 divided by 20, which is 3 metres.
\\(line 628 284 706 284 #facc15 dash=5,4 width=2\\)
\\(dimension 706 400 706 284 "h" offset=22 #facc15\\)
\\(text 260 250 "60 = m g h" white font="24px sans-serif" align=center\\)
\\(text 260 300 "60 = 2 × 10 × h" white font="24px sans-serif" align=center\\)
\\(text 260 360 "h = 3 m" #4ade80 font="34px sans-serif" align=center\\)
\\(clear\\)
\\(title "Check the options"\\)
Let us check the options. Five metres would mean no energy was lost at all. Four metres would mean friction took only 20 joules.
\\(text 400 175 "(A) 2 m   ✗  friction would have to take 80 J" #f87171 font="18px sans-serif" align=center\\)
\\(text 400 230 "(B) 3 m   ✓  100 − 40 = 60 J → h = 3 m" #4ade80 font="22px sans-serif" align=center\\)
Two metres would mean it took 80 joules. Only 3 metres matches the 40 joules that friction actually removed. So the answer is option B.
\\(text 400 285 "(C) 4 m   ✗  friction would take only 20 J" #f87171 font="18px sans-serif" align=center\\)
\\(text 400 340 "(D) 5 m   ✗  that means no friction at all" #f87171 font="18px sans-serif" align=center\\)
\\(rect 120 205 560 42 #4ade80 fill=rgba(74,222,128,0.12) width=2\\)
\\(clear\\)
\\(title "Exam shortcut: mass cancels!"\\)
Here is a shortcut worth remembering for exam day. Write one line: starting height energy, minus the work friction removes, equals final height energy. The mass appears in every term, so it cancels out.
\\(text 400 200 "m g h₁ − μ m g d = m g h₂" #facc15 font="28px sans-serif" align=center\\)
\\(text 400 265 "h₂ = h₁ − μ d" white font="30px sans-serif" align=center\\)
Five minus 0.2 times 10 equals 3. Notice we never needed the 2 kilograms.
\\(text 400 330 "h₂ = 5 − 0.2 × 10 = 3 m" #4ade80 font="30px sans-serif" align=center\\)
\\(text 400 410 "Trap: do not forget friction only acts on the rough part" #fb923c font="16px sans-serif" align=center\\)`,
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
