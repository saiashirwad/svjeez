# `@svjeez/code`

Syntax-highlighted `<Code>` blocks powered by Shiki (pure JS, no WASM/network), with typing reveals, token-diff morphing, and exact character-box measurement.

## Setup

```sh
npm install @svjeez/code @svjeez/fonts svjeez
```

- Pass a measurable monospace TTF/OTF `font` (e.g. `await google("JetBrains Mono", { ligatures: false })`).
- Import grammars from `@svjeez/code` (or any Shiki grammar `import toml from "shiki/langs/toml.mjs"`).
- Import built-in light/dark palettes from `@svjeez/code/palettes`, or construct a `Palette` from your `tokens()`.

## Mental model

- **`lang` is a grammar object, never a string:** Pass `lang={ts}`, not `lang="ts"`. Pass an array `[ts, bash, md]` to highlight the last grammar with embedded fenced languages.
- **`palette` maps 14 semantic roles to paints:** `plain`, `comment`, `punctuation`, `keyword`, `string`, `number`, `constant`, `variable`, `function`, `type`, `attribute`, `tag`, `inserted`, `deleted`. Built-ins (`tomorrow`, `solarized`, `gruvbox`, `rosePine`) adapt to light/dark; custom `Palette` objects accept `tokens()` directly.
- **Children must be one string:** Always wrap multi-line code in a template literal `` {`...`} ``; bare JSX text collapses whitespace onto one line with no error.
- **Splitting and morph keys (`by`):**
  - `by={lines}` (default): one `<Text key="line-N">` (1-based) per non-blank line. Pass `keys={[...]}` (one entry per line, including blank lines) so inserted/moved lines keep identity across `morph()`.
  - `by={tokens}`: one `<Text>` per token keyed `text#occurrence`.
  - `by={tokens.across(a, b, ...)}`: keys tokens by LCS diff across every state the morph visits so shared tokens slide cleanly. Every rendered source must be in the `across(...)` list.
- **Typing:** `typing={span(start, over)}` steps a character clip across lines. Prefer `by={lines}` with `typing` (cheap CSS); `by={tokens}` + `typing` emits many SMIL clips.
- **Exact highlights with `codeLayout(style, source)`:** Pass the same `{ font, size, lineHeight, tabSize, at }` as `<Code>`. Use `.box(line, from?, to?)`, `.find(text, occurrence?)`, and `.point(line, col)` (0-based, after tab expansion) to place highlights, cursors, or arrows.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/code` | `<Code lang font size palette lineHeight? tabSize? by? keys? typing? ...Common>`, `lines`, `tokens` (`.across(...sources)`), `codeLayout(style, source)`, `highlight(source, lang, { tabSize? })`, `ROLES` |
| `@svjeez/code` grammars | `bash`, `css`, `diff`, `go`, `html`, `js`, `json`, `jsx`, `md`, `ocaml`, `python`, `rust`, `sql`, `ts`, `tsx`, `yaml` |
| `@svjeez/code/palettes` | `palette(name, { light, dark })`, `tomorrow`, `solarized`, `gruvbox`, `rosePine` |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { Code, codeLayout, ts } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { google } from "@svjeez/fonts";
import { Group, Shape, rect, scene, span, tokens, track } from "svjeez";

const mono = await google("JetBrains Mono", { fallback: ["ui-monospace", "monospace"], ligatures: false });
const theme = tokens({
  light: { background: "#FFFFFF", blue: "#0A6CFF" },
  dark: { background: "#090A0C", blue: "#64D2FF" },
});

const SRC = `const total = items.reduce((sum, i) => sum + i.price, 0);
// tax applied below
return total * 1.2;`;
const style = { font: mono, size: 16, lineHeight: 1.5, at: [20, 20] as const };
const row = codeLayout(style, SRC).box(2);

export default scene(
  { size: [580, 110], duration: 3.5, title: "Typed code", desc: "Code types in, then highlights the return line.", theme, still: 3.4, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Shape
        geometry={rect(row.width + 16, row.height, { radius: 4 })}
        at={[row.x - 8, row.y]}
        fill={theme.blue}
        opacity={track(0).to(0.25, span(2.2, 0.4))}
      />
      <Code lang={ts} font={mono} size={16} lineHeight={1.5} palette={tomorrow} at={[20, 20]} typing={span(0.2, 1.8)}>
        {SRC}
      </Code>
    </Group>
  ),
);
```

## Gotchas

- `Type 'string' is not assignable to type 'Lang'` → Import the grammar object (`import { ts } from "@svjeez/code"`), not `"ts"`.
- Multi-line code renders on one line silently → Wrap the source in a JS template literal `` {`...`} `` instead of bare JSX text.
- `check --browser` reports `text-overflow` on a partial-line highlight shape under whole-line `<Code>` → Highlight the full line with `codeLayout(style, src).box(line)`, or switch to `by={tokens}`.
- `check --browser` reports `text-overflow` past the right canvas edge → `<Code>` does not wrap; widen the canvas, shrink `size`, or shorten lines.
- `This <Code>'s source is not one of the sources given to tokens.across()` → Pass every morph state's exact source string to `tokens.across(...)`.
- `keys names N lines, but the code has M` → Provide one key per line, including blank lines, and use `keys` only with `by={lines}`.
