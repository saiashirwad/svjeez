import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";

type Html = HtmlEscapedString | Promise<HtmlEscapedString>;

/** One stylesheet for every page: the system font, one accent, an 8px rhythm, light and dark. */
const STYLE = `
:root {
  color-scheme: light dark;
  --bg: #fbfbfa; --ink: #18181b; --muted: #6b6b73; --line: #dcdce0; --field: #ffffff; --stage: #f0f0ee;
  --accent: #2f5bea; --on-accent: #ffffff; --error: #c62828;
  font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #111113; --ink: #ececef; --muted: #9a9aa3; --line: #2e2e34; --field: #18181b; --stage: #19191c; --accent: #7c9cff; --on-accent: #0b0b0d; --error: #ff7a6e; }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; min-height: 100vh; background: var(--bg); color: var(--ink); }
a { color: inherit; text-underline-offset: 3px; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.name { margin: 0; font-size: 14px; font-weight: 600; letter-spacing: 0.02em; color: var(--muted); text-decoration: none; }
h1 { margin: 0; font-size: 24px; font-weight: 600; line-height: 1.3; letter-spacing: -0.01em; }
textarea, input, button, .button {
  font: inherit; color: inherit; border-radius: 8px; border: 1px solid var(--line); background: var(--field);
}
textarea, input { width: 100%; padding: 12px 16px; }
textarea { resize: vertical; display: block; }
button, .button { padding: 8px 16px; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 40px; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); font-weight: 600; }
button:disabled { opacity: 0.5; cursor: default; }
.error { margin: 0; color: var(--error); font-size: 14px; }
.muted { color: var(--muted); }

.calm { max-width: 640px; margin: 0 auto; padding: 16vh 24px 48px; display: grid; gap: 24px; }
.calm form { display: grid; gap: 16px; }
.calm .actions { display: flex; gap: 16px; align-items: center; justify-content: space-between; }
.calm .actions .error { flex: 1; }
.examples { margin: 0; display: flex; flex-wrap: wrap; gap: 8px 24px; font-size: 14px; color: var(--muted); }
.examples button { all: unset; cursor: pointer; text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
.examples button:hover { color: var(--ink); }
.examples button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; border-radius: 2px; }

.top { max-width: 1280px; margin: 0 auto; padding: 16px 24px; }
.work { max-width: 1280px; margin: 0 auto; padding: 0 24px 32px; display: grid; gap: 16px; }
.stage { margin: 0; background: var(--stage); border-radius: 8px; display: grid; place-items: center; overflow: hidden; }
.stage:has(img[hidden]) { aspect-ratio: 16 / 9; max-height: calc(100vh - 160px); width: 100%; }
.stage img { display: block; width: 100%; max-height: calc(100vh - 240px); object-fit: contain; }
.stage img[hidden] { display: none; }
.live { margin: 0; padding: 8px 16px; color: var(--muted); font-size: 14px; display: flex; gap: 8px; align-items: center; }
.live:empty { display: none; }
.live.working::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); animation: pulse 1.2s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: 0.25; } }
@media (prefers-reduced-motion: reduce) { .live.working::before { animation: none; } }
.steps { font-size: 14px; color: var(--muted); }
.steps summary { cursor: pointer; width: max-content; }
.steps ol { margin: 8px 0 0; padding-left: 24px; }
.summary { margin: 0; }
.bar { display: grid; gap: 8px; }
.change { display: flex; gap: 8px; align-items: flex-end; }
.change textarea { min-height: 48px; }
.change button { min-height: 48px; }
.tools { display: flex; flex-wrap: wrap; gap: 8px; }
.tools .button, .tools button { background: transparent; }
@media (max-width: 600px) {
  .calm { padding-top: 10vh; }
  .work, .top { padding-left: 16px; padding-right: 16px; }
  .change { flex-direction: column; align-items: stretch; }
  .tools { display: grid; grid-template-columns: 1fr 1fr; }
  .tools > * { justify-content: center; }
}
`;

/** Enter sends the form a textarea sits in; Shift+Enter is a new line. */
const ENTER = `
for (const box of document.querySelectorAll("textarea")) {
  box.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      box.form.requestSubmit();
    }
  });
}
`;

/** A page of this site: its title, its body, and any script after the shared one. */
export const layout = (title: string, body: Html, script = "") => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${raw(STYLE)}</style>
</head>
<body>
${body}
<script>${raw(ENTER + script)}</script>
</body>
</html>
`;
