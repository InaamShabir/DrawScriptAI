// Saved lessons, kept in chrome.storage.local under "library" (newest first, max 60).
(function (global) {
  "use strict";
  const KEY = "library", MAX = 60;
  function titleOf(script) {
    const speech = String(script || "").split(/\\\([\s\S]*?\\\)/)[0] || "";
    const first = speech.replace(/\s+/g, " ").trim() || (String(script).match(/"([^"]{3,60})"/) || [])[1] || "Untitled lesson";
    return first.length > 64 ? first.slice(0, 61) + "…" : first;
  }
  function list(cb) {
    try { chrome.storage.local.get([KEY], (r) => cb((r && r[KEY]) || [])); } catch (e) { cb([]); }
  }
  function write(items, cb) {
    try { chrome.storage.local.set({ [KEY]: items.slice(0, MAX) }, () => cb && cb(items)); } catch (e) { cb && cb(items); }
  }
  function add(script, extra, cb) {
    list((items) => {
      const dup = items.find((i) => i.script === script);
      if (dup) { cb && cb(dup); return; }
      const item = Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: titleOf(script), script, ts: Date.now() }, extra || {});
      write([item].concat(items), () => cb && cb(item));
    });
  }
  function remove(id, cb) { list((items) => write(items.filter((i) => i.id !== id), cb)); }
  function get(id, cb) { list((items) => cb(items.find((i) => i.id === id) || null)); }
  function clearAll(cb) { write([], cb); }
  global.DrawScriptLibrary = { list, add, remove, get, clearAll, titleOf };
})(window);
