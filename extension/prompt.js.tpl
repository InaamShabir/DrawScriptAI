// DrawScript 3D prompt builder. The base prompt is generated from src/data/presets.ts
// by scripts/sync-extension.mjs — do not edit DS_BASE_PROMPT by hand.
(function (global) {
  "use strict";
  const DS_BASE_PROMPT = __BASE_PROMPT__;

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
