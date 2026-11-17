import { html } from "hono/html";
import { defaults, type Schema } from "svjeez/params";

export interface Entry {
  readonly name: string;
  readonly params?: Schema;
}

const example = (name: string, params: Schema): string => {
  const key = Object.keys(params).find((k) => params[k]?.kind !== "list");

  const query =
    key === undefined ? "" : new URLSearchParams({ [key]: String(defaults(params)[key]) });

  return `/${name}.svg?${query}`;
};

const card = ({ name, params }: Entry) => html`<li>
  <a href="/${name}.svg"><img src="/${name}.svg" alt="${name}" loading="lazy" width="480" height="270"></a>
  <h2>${name}</h2>
  ${
    params
      ? html`<p><a href="/${name}.json">params</a> · <a href="${example(name, params)}">example query</a></p>
  <form action="/${name}.svg" method="get"><input name="prompt" maxlength="300" placeholder="Describe it" required><button>Fill</button></form>`
      : ""
  }
</li>`;

/** The index: every scene as an image, and for a scene with params its schema, an example query and a prompt. */
export const page = (entries: readonly Entry[]) => html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>svjeez scenes</title>
<style>
:root { color-scheme: light dark; --bg: #fafafa; --ink: #1d1d1f; --muted: #6e6e73; --line: #e2e2e5; }
@media (prefers-color-scheme: dark) { :root { --bg: #111113; --ink: #f2f2f4; --muted: #9a9aa2; --line: #2a2a2e; } }
body { margin: 0; padding: 32px; background: var(--bg); color: var(--ink); font: 15px/1.5 system-ui, sans-serif; }
h1 { font-size: 22px; margin: 0 0 24px; }
ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 24px; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); }
img { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 8px; }
h2 { font-size: 15px; margin: 8px 0 0; }
p { margin: 2px 0; color: var(--muted); }
a { color: inherit; }
form { display: flex; gap: 6px; margin-top: 6px; }
input, button { font: inherit; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: inherit; }
input { flex: 1; min-width: 0; }
</style>
</head>
<body>
<h1>svjeez scenes</h1>
<ul>
${entries.map(card)}
</ul>
</body>
</html>
`;
