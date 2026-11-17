import { html, raw } from "hono/html";

const STYLE = `
:root { color-scheme: light dark; --bg: #fafafa; --panel: #fff; --ink: #1d1d1f; --muted: #6e6e73; --line: #e2e2e5; --accent: #0a66ff; --error: #d93025; }
@media (prefers-color-scheme: dark) { :root { --bg: #111113; --panel: #1a1a1d; --ink: #f2f2f4; --muted: #9a9aa2; --line: #2a2a2e; --accent: #5ea0ff; --error: #ff6b5e; } }
* { box-sizing: border-box; }
body { margin: 0; height: 100vh; display: grid; grid-template-columns: minmax(300px, 1fr) 2fr; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
aside { display: flex; flex-direction: column; border-right: 1px solid var(--line); min-height: 0; }
header, footer { padding: 12px 16px; border-bottom: 1px solid var(--line); }
footer { border-bottom: 0; border-top: 1px solid var(--line); }
#log { flex: 1; overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
.user { align-self: flex-end; background: var(--accent); color: #fff; padding: 6px 10px; border-radius: 10px; max-width: 85%; white-space: pre-wrap; }
.assistant { background: var(--panel); border: 1px solid var(--line); padding: 6px 10px; border-radius: 10px; max-width: 85%; }
.progress { color: var(--muted); font-size: 13px; }
.progress::before { content: "· "; }
.error { color: var(--error); }
textarea, button { font: inherit; color: inherit; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
textarea { width: 100%; padding: 8px 10px; resize: vertical; }
.row { display: flex; gap: 8px; margin-top: 8px; align-items: center; }
button { padding: 6px 14px; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: progress; }
main { display: flex; flex-direction: column; gap: 12px; padding: 24px; min-width: 0; }
main img { width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
a { color: inherit; }
`;

const SCRIPT = `
const id = document.body.dataset.id;
const log = document.getElementById("log");
const form = document.querySelector("form");
const box = form.querySelector("textarea");
const send = form.querySelector("button");
const undo = document.getElementById("undo");
const deck = document.getElementById("deck");

const line = (role, text) => {
  const p = document.createElement("p");
  p.className = role;
  p.textContent = text;
  log.append(p);
  log.scrollTop = log.scrollHeight;
};

const show = (version) => { deck.src = "/s/" + id + ".svg?v=" + version; };

const load = async () => {
  const state = await (await fetch("/s/" + id + "/state")).json();
  log.replaceChildren();
  for (const entry of state.log) line(entry.role, entry.text);
  show(state.version);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = box.value.trim();
  if (!text) return;
  send.disabled = undo.disabled = true;
  line("user", text);
  box.value = "";
  try {
    const response = await fetch("/s/" + id + "/message", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) });
    if (!response.ok) throw new Error(await response.text());
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let rest = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      const lines = (rest + value).split("\\n");
      rest = lines.pop();
      for (const raw of lines) {
        const event = JSON.parse(raw);
        line(event.type === "done" ? "assistant" : "progress", event.text);
        if (event.version !== undefined) show(event.version);
      }
    }
  } catch (failure) {
    line("error", failure.message);
    box.value = text;
  } finally {
    send.disabled = undo.disabled = false;
  }
});

undo.addEventListener("click", async () => {
  const response = await fetch("/s/" + id + "/undo", { method: "POST" });
  if (response.ok) await load(); else line("error", await response.text());
});

load();
`;

/** A session: the conversation and a message box on the left, the deck on the right, updating as slides land. */
export const studio = (id: string) => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deck session</title>
<style>${raw(STYLE)}</style>
</head>
<body data-id="${id}">
<aside>
  <header><strong>Build a deck by conversation</strong> · <a href="/">templates</a></header>
  <div id="log" aria-live="polite"></div>
  <footer>
    <form>
      <textarea rows="3" maxlength="2000" placeholder="Describe the deck, or what to change in it…" required></textarea>
      <div class="row"><button>Send</button><button type="button" id="undo">Undo</button></div>
    </form>
  </footer>
</aside>
<main>
  <img id="deck" alt="The deck as it stands">
  <p><a href="/s/${id}.svg">This deck's own URL</a>: anyone with it can view the deck.</p>
</main>
<script>${raw(SCRIPT)}</script>
</body>
</html>
`;
