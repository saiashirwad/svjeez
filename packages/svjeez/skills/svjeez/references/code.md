# Syntax highlighting with @svjeez/code

`@svjeez/code` is a separate package: `npm i -D @svjeez/code`. `highlight(source, lang)` tokenizes with Shiki while the scene compiles and returns role-tagged runs that `code()` and `terminal()` color from the scene's theme. It is synchronous and the SVG carries no script. Use it instead of hand-writing `["keyword", "const"]` runs for anything longer than a few tokens.

```tsx
import { highlight } from "@svjeez/code";
import { render, code } from "svjeez";

import { css, mono, theme } from "./style";

const snippet = code(highlight("const answer = 42;", "ts"), { x: 40, y: 60, fontSize: 20, theme, font: mono });

export default () => render({ width: 480, height: 120, duration: 1, title: "Snippet", css }, snippet.node);
```

- `highlight(source, lang, { tabSize, grammars })` returns `CodeTokens` (typed `Highlighted`): one array per line, a bare string for plain text, `[role, text]` for the rest. Pass it straight to `code()`, or as `terminal()` output.
- Do not pass Shiki's own tokens to `code()`. They carry fixed hex colors, so they ignore `theme` and break `adaptive()` and `variables()`. `highlight()` gives roles, so the palette stays yours.
- `lang` takes `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `bash` (`sh`, `shell`, `zsh`), `python` (`py`), `rust` (`rs`), `go`, `sql`, `yaml` (`yml`), `md` (`markdown`) and `diff`, plus the long names `typescript` and `javascript`. Another language needs its grammar: `highlight(src, "toml", { grammars: [toml] })` after `import toml from "shiki/langs/toml.mjs"`.
- Tabs become spaces at `tabSize` stops, 2 by default, because `code()` lays out one column per character.
- The roles come from one scope table in the package, `src/scopes.ts`. Diff lines use `red`, `green`, `yellow` and `cyan`.
- Runs carry no ids. To name a run for `get()` or an exact `morph()` pairing, map the pieces yourself and add the third element, `["fn", "fib", "name"]`. `morph()` pairs by text and position otherwise, so two highlighted versions of one snippet morph without ids.

## Palettes

`@svjeez/code/palettes` holds the editor palettes as base16 themes: `tomorrow` and `tomorrowNight`, `solarizedLight` and `solarizedDark`, `gruvboxLight` and `gruvboxDark`, `rosePineDawn` and `rosePine`. Import them from there only, which does not load Shiki. Pair a light and a dark one in `adaptive()`:

```ts
import { tomorrow, tomorrowNight } from "@svjeez/code/palettes";
import { adaptive } from "svjeez";

const { theme, css } = adaptive({ dark: tomorrowNight, light: tomorrow });
```

## Errors

| Error | Fix |
| --- | --- |
| `highlight() does not know the language "…". It knows: …` | Use one of the listed names, or pass the grammar in `grammars`. |
| `highlight() needs tabSize to be a whole number of at least 1, got …` | Pass a positive integer. |
