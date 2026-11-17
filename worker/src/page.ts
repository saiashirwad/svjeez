import { html, raw } from "hono/html";
import { defaults, type Schema } from "svjeez/params";

export interface Entry {
  readonly name: string;
  readonly params: Schema;
}

const example = (name: string, params: Schema): string => {
  const key = Object.keys(params).find((k) => params[k]?.kind !== "list");

  const query =
    key === undefined ? "" : new URLSearchParams({ [key]: String(defaults(params)[key]) });

  return `/${name}.svg?${query}`;
};

const thumbnail = (name: string) =>
  html`<img class="thumb" src="/${name}.svg" alt="${name}, as it renders with its defaults" loading="lazy">`;

const option = ({ name }: Entry, i: number) => html`<label class="option">
  <input type="radio" name="template" value="${name}" ${i === 0 ? "checked" : ""}>
  ${thumbnail(name)}
  <span>${name}</span>
</label>`;

const card = ({ name, params }: Entry) => html`<li>
  <a href="/${name}.svg">${thumbnail(name)}</a>
  <h3>${name}</h3>
  <p><a href="/${name}.json">params</a> · <a href="${example(name, params)}">example query</a></p>
</li>`;

const STYLE = `
:root { color-scheme: light dark; --bg: #fafafa; --panel: #fff; --ink: #1d1d1f; --muted: #6e6e73; --line: #e2e2e5; --accent: #0a66ff; }
@media (prefers-color-scheme: dark) { :root { --bg: #111113; --panel: #1a1a1d; --ink: #f2f2f4; --muted: #9a9aa2; --line: #2a2a2e; --accent: #5ea0ff; } }
body { margin: 0 auto; max-width: 1200px; padding: 32px; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 20px; }
h2 { font-size: 16px; margin: 40px 0 12px; }
h3 { font-size: 15px; margin: 8px 0 0; }
p { margin: 2px 0; color: var(--muted); }
a { color: inherit; }
.thumb { display: block; width: 100%; aspect-ratio: 16 / 9; object-fit: contain; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; }
fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
legend { padding: 0; margin-bottom: 8px; color: var(--muted); }
.option { cursor: pointer; font-size: 14px; }
.option input { position: absolute; opacity: 0; }
.option:has(:checked) .thumb { border-color: var(--accent); box-shadow: 0 0 0 2px var(--accent); }
.option:has(:focus-visible) .thumb { outline: 2px solid var(--accent); outline-offset: 2px; }
textarea, button { font: inherit; color: inherit; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
textarea { display: block; box-sizing: border-box; width: 100%; margin: 16px 0 8px; padding: 8px 10px; resize: vertical; }
button { padding: 6px 16px; cursor: pointer; }
button:disabled { opacity: 0.6; cursor: progress; }
#result { margin-top: 24px; }
#result img { max-width: 100%; }
#error { color: inherit; white-space: pre-wrap; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
`;

const SCRIPT = `
const form = document.querySelector("form");
const result = document.getElementById("result");
const image = document.getElementById("image");
const link = document.getElementById("link");
const schema = document.getElementById("schema");
const error = document.getElementById("error");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const name = data.get("template");
  const url = "/" + name + ".svg?" + new URLSearchParams({ prompt: data.get("prompt") });

  form.querySelector("button").disabled = true;
  result.hidden = false;
  image.hidden = true;
  error.textContent = "Generating…";
  link.href = url;
  link.textContent = location.origin + url;
  schema.href = "/" + name + ".json";

  try {
    const response = await fetch(url);

    if (!response.ok) throw new Error(await response.text());
    image.src = URL.createObjectURL(await response.blob());
    image.hidden = false;
    error.textContent = "";
  } catch (failure) {
    error.textContent = failure.message;
  } finally {
    form.querySelector("button").disabled = false;
  }
});
`;

/** The index: one prompt for any template, then every template with its schema and an example query. */
export const page = (entries: readonly Entry[]) => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>svjeez scenes</title>
<style>${raw(STYLE)}</style>
</head>
<body>
<h1>svjeez scenes</h1>
<form action="/generate" method="get">
  <fieldset>
    <legend>Template</legend>
    ${entries.map(option)}
  </fieldset>
  <textarea name="prompt" rows="3" maxlength="600" required placeholder="Describe what to draw: a state machine for a vending machine, a bar chart of rainfall by month, a Rust function that parses a date…"></textarea>
  <button>Generate</button>
</form>
<section id="result" hidden>
  <img id="image" alt="The generated scene" hidden>
  <p><a id="link"></a> · <a id="schema">params</a></p>
  <p id="error" role="status"></p>
</section>
<h2>Templates</h2>
<ul>${entries.map(card)}</ul>
<script>${raw(SCRIPT)}</script>
</body>
</html>
`;
