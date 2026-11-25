# Highlighted code

`@svjeez/code` (`npm i @svjeez/code@next`) draws source code as a `<Code>` node. It tokenizes with Shiki while the scene compiles and colors each token from a palette, in light and dark. The SVG carries no script.

```tsx
import { Code, ts } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { google } from "@svjeez/fonts";
import { Group, Shape, scene, span } from "svjeez";

const mono = await google("JetBrains Mono", { ligatures: false });

export default scene({ size: [400, 80], duration: 3, title: "Snippet", loop: false }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={tomorrow.plain} />
    <Code lang={ts} font={mono} size={16} palette={tomorrow} at={[20, 20]} typing={span(0.3, 1.5)}>
      {`const answer = 42;\nconsole.log(answer);`}
    </Code>
  </Group>
));
```

The source is one string child. `lang` takes a Shiki grammar. The values `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `bash`, `python`, `rust`, `ocaml`, `go`, `sql`, `yaml`, `md` and `diff` come from `@svjeez/code`, and any other language is its Shiki module, as `import toml from "shiki/langs/toml.mjs"`. A list loads every grammar in it and highlights as the last one, so `lang={[ts, bash, md]}` is Markdown whose fenced code is TypeScript or Bash. Tabs become `tabSize` spaces (default 2).

`<Code>` lays each line out as its own `<Text>`, `lineHeight` (default 1.5) times `size` apart, and takes a node's usual props: `key`, `ref`, `at`, `anchor`, `opacity`, `motion`, `clip`. Empty lines draw nothing.

`by` picks how it cuts the code into nodes, and so what a morph can match: `by={lines}` (the default, from `@svjeez/code`) is a `<Text>` per line; `by={tokens}` is a `<Text>` per token (a word, a run of operator characters like `>>=`, or one other character), each set where the font's advances put it. A split is a function `(code: Highlighted) => CodePart[]`, each part `{ key, line, col, pieces }`, so you can write your own.

## Palettes

`palette` has one paint per role: `plain`, `comment`, `punctuation`, `keyword`, `string`, `number`, `constant`, `variable`, `function`, `type`, `tag`, `inserted`, `deleted`. Any object with those keys works, so a scene's own tokens do: `{ plain: theme.text, keyword: theme.magenta, … }`.

`@svjeez/code/palettes` (it doesn't load Shiki) has `tomorrow`, `solarized`, `gruvbox` and `rosePine`, each a token set with a light and a dark value, so the SVG follows the viewer's scheme. `palette("name", { light, dark })` makes your own from a hex per role and scheme; its tokens are named `name-keyword` and so on.

## Typing, lines, morphing

- `typing={span(0.3, 1.5)}` types the code in over that span, character by character, part after part, at one speed. One clip per part (line or token), so it costs one lane per part. Typing is a track: with `morph`, every state must type the same way, so type code that is not morphed.
- Each line is keyed `line-1`, `line-2`… A ref on the `<Code>` reaches them: `code.part("line-3").topLeft` places a highlight bar, an arrow or a cursor, and follows the line when it moves. `keys={["sig", "base", "rec"]}` names the lines yourself, one per line (empty ones included); it only goes with `by={lines}`.
- `morph.between` goes from one `<Code key="code">` to another: parts with the same key move, parts whose words change crossfade, new ones enter and old ones leave. With lines, key them by what they are (`keys`), not their number, so a line that moves to another row keeps its identity.
- **A rewrite that moves tokens** (a "magic move"): `by={tokens}` in every state. A token is keyed by its text and how many of the same text came before it (`let#0`, `let#1`…), so the tokens both sources share slide to their new columns and lines, and the rest fade. When a rewrite adds or drops a repeated token early on, that numbering shifts every later twin; `by={tokens.across(BEFORE, AFTER)}`, given every source the morph goes through in order, keys by a diff instead: tokens in the same order keep their key, a token that moved pairs with its nearest twin, the rest enter and leave.

```tsx
import { Code, ocaml, tokens } from "@svjeez/code";

const by = tokens.across(ANGSTROM, PARSEFF);

morph.between(
  [ANGSTROM, PARSEFF].map((source) => (
    <Code key="code" lang={ocaml} font={mono} size={22} palette={palette} at={[80, 200]} by={by}>
      {source}
    </Code>
  )),
  [span(1, 1.2)],
  { stagger: 0.01 },
);
```

## Where characters are

`codeLayout(style, source)` lays the source out as `<Code>` with the same `font`, `size`, `lineHeight` and `tabSize` does, measuring with the font, so nothing multiplies a character width. Give it the `<Code>`'s `at` (no `anchor`) and its answers are in the same coordinates. Lines and columns count from 0, like string indices, after tabs become spaces; each line's cell is `lineHeight × size` tall, centered on its text, so cells tile with no gap.

- `point(line, col)` is the top-left corner of that character's cell: a cursor's place.
- `box(line, from, to)` is the cells of columns `from` up to `to` (the whole line by default): `{ x, y, width, height, at, size, center }`.
- `find(text, occurrence = 0)` is the box of the `occurrence`-th place `text` appears on one line.
- `lines` is the source's lines as drawn.

```tsx
const style = { font: mono, size: 22, lineHeight: 1.6, at: [80, 200] as const };
const where = codeLayout(style, OCTET);
const bad = where.find("Out_of_range", 1);

<Shape geometry={rect(...bad.size, { radius: 4 })} at={bad.at} fill={alpha(theme.red, 0.2)} />
<Code lang={ocaml} palette={palette} {...style}>{OCTET}</Code>
```

- `highlight(source, lang, { tabSize })` returns the lines as `[role, text]` pieces for anything else that draws tokens.

## Errors

A `lang` with no grammar in it, a child that isn't one string, a `size` or `lineHeight` that isn't positive, a `tabSize` below 1, `keys` whose length isn't the number of lines or that come with another split, a source `tokens.across()` wasn't given, and a `codeLayout()` line, column or text the code doesn't have.
