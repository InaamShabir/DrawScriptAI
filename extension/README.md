# DrawScript 3D — Chrome extension (v2)

Works on chatgpt.com, chat.openai.com and claude.ai.

## Install
1. Open `chrome://extensions` and switch on **Developer mode**.
2. Click **Load unpacked** and pick this folder (unzip it first).
3. Open ChatGPT or Claude. A **DrawScript 3D** dock appears near the bottom of the page.

## Use
1. Type your question in the chat box, for example *"Explain work done on an inclined plane"*.
2. Press **Ask & Draw**. The extension wraps your question with the DrawScript instructions, sends it,
   waits for the reply to finish and opens the animated 3D canvas automatically.
3. Any DrawScript reply also gets a **Draw** button; **Draw latest** replays the newest one.

Canvas controls: drag to orbit, scroll / pinch to zoom, double-click to reset, **Esc** to close.
Replay, stop, voice, speed (0.5×–3×), themes (Dark, Chalkboard, Blueprint, Paper), fullscreen,
save as PNG, copy script and open in the full Studio are all in the panel.

## New in v3
* **Lesson player** – previous / play-pause / next, a step slider, and every `clear` starts a new step.
* **Cleaner drawings** – labels that would overlap are moved apart automatically; screens auto-clear.
* **Record video** (WebM, silent), save PNG, share link, copy script.
* **Library** – every lesson you draw is saved; reopen it any time.
* **DrawScript Lab** (dock → *Lab*, or the toolbar popup) – ask an AI directly with your own free
  Gemini or OpenAI key, paste any script, or browse the library. No ChatGPT tab needed.

## Options
Click the toolbar icon (or **More** on the dock): auto-draw, auto-send, captions, voice / rate / volume,
speed, theme, window mode, dock side, subject, level, length, narration language, extra instructions
and the Studio URL. Everything saves instantly.

## Notes
* If the chat box can't be filled automatically, the prompt is copied to the clipboard — paste it and send.
* Replies that arrive in an ordinary message (not a code block), or with commands slightly malformed,
  are still understood.
