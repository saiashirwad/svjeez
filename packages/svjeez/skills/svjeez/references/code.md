# Syntax highlighting with @svjeez/code

`@svjeez/code` is a separate package: `npm i -D @svjeez/code`. `highlight(source, lang)` tokenizes with Shiki while the scene compiles and returns role-tagged runs that `code()` and `terminal()` color from the scene's theme. It is synchronous and the SVG carries no script. Use it instead of hand-writing `["keyword", "const"]` runs for anything longer than a few tokens.

```tsx
import { highlight } from "@svjeez/code";
import { render } from "svjeez";
import { code } from "svjeez/extras";
import { css, mono, theme } from "./style";

const snippet = code(highlight("const answer = 42;", "ts"), { x: 40, y: 60, fontSize: 20, theme, font: mono });

export default () => render({ width: 480, height: 120, duration: 1, title: "Snippet", css }, snippet.node);
```

- `highlight(source, lang, { tabSize, grammars })` returns `CodeTokens`: one array per line, a bare string for plain text, `[role, text]` for the rest. Pass it straight to `code()`, or as `terminal()` output.
- Do not pass Shiki's own tokens to `code()`. They carry fixed hex colors, so they ignore `theme` and break `adaptive()` and `variables()`. `highlight()` gives roles, so the palette stays yours.
- `lang` takes `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `bash` (`sh`, `zsh`), `python`, `rust`, `go`, `sql`, `yaml`, `md` and `diff`, with the usual aliases. Another language needs its grammar: `highlight(src, "toml", { grammars: [toml] })` after `import toml from "shiki/langs/toml.mjs"`.
- Tabs become spaces at `tabSize` stops, 2 by default, because `code()` lays out one column per character.
- The roles come from one scope table in the package, `src/scopes.ts`. Diff lines use `red`, `green` and `cyan`.
- Runs carry no ids. To name a run for `get()` or an exact `morph()` pairing, map the pieces yourself and add the third element, `["fn", "fib", "name"]`. `morph()` pairs by text and position otherwise, so two highlighted versions of one snippet morph without ids.

## Errors

| Error | Fix |
| --- | --- |
| `highlight() does not know the language "…". It knows: …` | Use one of the listed names, or pass the grammar in `grammars`. |
| `highlight() needs tabSize to be a whole number of at least 1, got …` | Pass a positive integer. |
