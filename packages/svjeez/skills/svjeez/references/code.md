# Highlighted code

`@svjeez/code` (`npm i @svjeez/code@next`) draws source code as a `<Code>` node. It tokenizes with Shiki while the scene compiles and colors each token from a palette, in light and dark. The SVG carries no script.

```tsx
import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { google } from "@svjeez/fonts";
import { Group, Shape, scene, span } from "svjeez";

const mono = await google("JetBrains Mono", { ligatures: false });

export default scene({ size: [400, 80], duration: 3, title: "Snippet", loop: false }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={tomorrow.plain} />
    <Code lang="ts" font={mono} size={16} palette={tomorrow} at={[20, 20]} typing={span(0.3, 1.5)}>
      {`const answer = 42;\nconsole.log(answer);`}
    </Code>
  </Group>
));
```

The source is one string child. `lang` is `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `bash` (`sh`, `shell`, `zsh`), `python` (`py`), `rust` (`rs`), `go`, `sql`, `yaml` (`yml`), `md` or `diff`; another language takes its Shiki grammar: `grammars={[toml]}` after `import toml from "shiki/langs/toml.mjs"`. Tabs become `tabSize` spaces (default 2).

`<Code>` lays each line out as its own `<Text>`, `lineHeight` (default 1.5) times `size` apart, and takes a node's usual props: `key`, `ref`, `at`, `anchor`, `opacity`, `motion`, `clip`. Use a monospace `font` so columns line up. Empty lines draw nothing.

## Palettes

`palette` has one paint per role: `plain`, `comment`, `punctuation`, `keyword`, `string`, `number`, `constant`, `variable`, `function`, `type`, `attribute` (a JSX or HTML attribute name), `tag`, `inserted`, `deleted`. Any object with those keys works, so a scene's own tokens do: `{ plain: theme.text, keyword: theme.magenta, … }`.

`@svjeez/code/palettes` (it doesn't load Shiki) has `tomorrow`, `solarized`, `gruvbox` and `rosePine`, each a token set with a light and a dark value, so the SVG follows the viewer's scheme. `palette("name", { light, dark })` makes your own from a hex per role and scheme; its tokens are named `name-keyword` and so on.

## Typing, lines, morphing

- `typing={span(0.3, 1.5)}` types the code in over that span, character by character, line after line, at one speed. One clip per line, so it costs one lane per line. Typing is a track: with `morph`, every state must type the same way, so type code that is not morphed.
- Each line is keyed `line-1`, `line-2`… A ref on the `<Code>` reaches them: `code.part("line-3").topLeft` places a highlight bar, an arrow or a cursor, and follows the line when it moves. `keys={["sig", "base", "rec"]}` names the lines yourself, one per line (empty ones included).
- `morph.between` goes from one `<Code key="code">` to another: lines with the same key move, lines whose words change crossfade, new ones enter and old ones leave. Key the lines by what they are (`keys`), not their number, so a line that moves to another row keeps its identity.- `highlight(source, lang, { tabSize, grammars })` returns the lines as `[role, text]` pieces for anything else that draws tokens.

## Errors

A language it doesn't know (the message lists the ones it does), a child that isn't one string, a `size` or `lineHeight` that isn't positive, a `tabSize` below 1, and `keys` whose length isn't the number of lines.
