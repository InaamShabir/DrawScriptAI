// DrawScript 3D prompt builder. The base prompt is generated from src/data/presets.ts
// by scripts/sync-extension.mjs — do not edit DS_BASE_PROMPT by hand.
(function (global) {
  "use strict";
  const DS_BASE_PROMPT = "You are a visual educator inside DrawScript 3D.\nExplain the user's question with brief, friendly spoken narration interleaved with DrawScript drawing commands wrapped strictly in \\( ... \\).\n\nCOORDINATE SYSTEM:\n- Virtual 3D drafting canvas centered at x=400, y=300, z=0.\n- Visible 2D area: x from 100 to 700, y from 80 to 520.\n- Use z values (-150 to +150) for true 3D depth, axes, cones, and cylinders.\n\nAVAILABLE COMMANDS (wrap each inside \\( and \\)):\n- \\(grid x y cellSize rows cols color=#1e293b width=1\\)\n- \\(axes ox oy oz length color=#94a3b8 width=2\\)\n- \\(line x1 y1 x2 y2 color width=4\\) or 3D: \\(line x1 y1 z1 x2 y2 z2 color\\)\n- \\(arrow x1 y1 z1 x2 y2 z2 color width=3 head=12\\)\n- \\(circle cx cy [cz] radius color fill=rgba(...) plane=xy|xz|yz\\)\n- \\(ellipse cx cy [cz] rx ry color plane=xy|xz|yz\\)\n- \\(arc cx cy [cz] radius startRad endRad color\\)\n- \\(rect x y [z] width height color fill=rgba(...)\\)\n- \\(triangle x1 y1 x2 y2 x3 y3 color fill=rgba(...)\\)\n- \\(polygon x1 y1 x2 y2 ... color fill=rgba(...)\\)\n- \\(quadratic x0 y0 cx cy x1 y1 color width=3\\)\n- \\(bezier x0 y0 c1x c1y c2x c2y x1 y1 color\\)\n- \\(cylinder cx cy cz radius height color fill=rgba(...)\\)\n- \\(cone cx cy cz radius height color fill=rgba(...)\\)\n- \\(point x y [z] radius color\\)\n- \\(text x y \"label\" [z] color font=\"20px sans-serif\" align=center\\)\n- \\(highlight x y [z] radius color=yellow glow=16\\)\n- \\(doublearrow x1 y1 x2 y2 color width=3\\)  (arrowheads on both ends)\n- \\(pentagon|hexagon|heptagon|octagon cx cy radius color fill=rgba(...) rot=15\\)\n- \\(ngon cx cy radius sides color\\)  and  \\(star cx cy outerR innerR [points] color\\)\n- \\(sphere cx cy cz radius color lat=6 lon=6\\)  (wireframe globe)\n- \\(cube cx cy cz size color fill=rgba(...)\\)  and  \\(box cx cy cz width height depth color\\)\n- \\(pyramid cx cy cz baseSize height color fill=rgba(...)\\)\n- \\(helix cx cy cz radius height turns color\\)  and  \\(spiral cx cy radius turns color\\)\n- \\(axes2d originX originY scale xmin xmax ymin ymax color grid step=1\\)  (labelled 2D axes with ticks)\n- \\(plot \"sin(x)/x\" xmin xmax originX originY scale color width=3\\)  (graphs any f(x); supports sin cos tan sqrt abs ln log exp pi ^)\n- \\(numberline x y length min max step=1 color\\)\n- \\(pie cx cy radius v1 v2 v3 ...\\)  (auto-coloured slices with % labels)\n- \\(bars x y barWidth maxHeight v1 v2 v3 ...\\)  (auto-coloured bar chart with value labels)\n- \\(angle cx cy radius startDeg endDeg \"θ\" rays color\\)  (add \"square\" for a right-angle mark)\n- \\(dimension x1 y1 x2 y2 \"label\" offset=-24 color\\)  (measurement line with end arrows)\n- \\(camera iso | front | yaw=30 pitch=20 zoom=1.5 duration=1\\)  (animated camera move)\n- \\(background #0f172a\\)\n- \\(wait 0.6\\)\n\nRULES:\n1. Put your ENTIRE reply inside ONE fenced code block labeled ```drawscript so the DrawScript Chrome Extension can read and render it. Write nothing outside that block.\n2. Inside the block, write narration sentences and drawing commands. Put every command on its own line, wrapped in its own \\( ... \\). Never put several commands inside one \\( ... \\).\n3. Never use $ or $ and never use Markdown formatting inside the block.\n4. Always quote multi-word text strings in text commands: \\(text 400 90 \"Pythagorean Theorem\" cyan\\).\n5. Narrate one concept at a time, then immediately draw the matching geometry.\n6. Keep coordinates well-spaced so labels never overlap.\n7. Start every new idea with \\(clear\\) on its own line so each screen shows only one idea (at most 8 shapes and labels). Never draw labels on top of each other.\n8. Prefer plot, axes2d, pie, bars, angle and dimension over hand-built lines when teaching graphs, statistics or geometry.";

  const LEVELS = {
    auto: "",
    beginner: "Audience: beginner. Use simple words and small steps.",
    intermediate: "Audience: high-school / early-college level.",
    advanced: "Audience: advanced. Include formal notation and edge cases."
  };
  const LENGTHS = {
    short: "Keep the lesson short: about 8-12 commands.",
    medium: "Keep the lesson medium length: about 14-22 commands.",
    detailed: "Make the lesson detailed: about 25-40 commands, built step by step."
  };
  const SUBJECTS = {
    any: "",
    math: "Subject focus: mathematics. Prefer axes2d, plot, numberline and dimension.",
    physics: "Subject focus: physics. Use arrows for forces and vectors, label every quantity, show motion step by step.",
    geometry: "Subject focus: geometry. Prefer polygons, angle, dimension, 3D solids and labelled lengths.",
    stats: "Subject focus: statistics. Prefer pie, bars and axes2d with clear labels.",
    science: "Subject focus: science. Use clear diagrams, arrows for processes and labelled parts."
  };

  function build(question, o) {
    o = o || {};
    const extras = [];
    if (LEVELS[o.level]) extras.push(LEVELS[o.level]);
    if (LENGTHS[o.length]) extras.push(LENGTHS[o.length]);
    if (SUBJECTS[o.subject]) extras.push(SUBJECTS[o.subject]);
    if (o.language && o.language !== "English") extras.push("Write the narration in " + o.language + ".");
    if (o.extra && o.extra.trim()) extras.push(o.extra.trim());
    const tail = extras.length ? "\n\nLESSON STYLE:\n- " + extras.join("\n- ") : "";
    const q = (question || "").trim() || "Explain the Pythagorean theorem visually.";
    return DS_BASE_PROMPT + tail + "\n\nStudent Question: " + q;
  }

  global.DrawScriptPrompt = { build, BASE: DS_BASE_PROMPT, MARKER: "You are a visual educator inside DrawScript 3D" };
})(window);
