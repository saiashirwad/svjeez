# @svjeez/code

Syntax highlighting for [svjeez](https://www.npmjs.com/package/svjeez) scenes. `highlight()` tokenizes source text with Shiki while the scene compiles and gives back runs tagged with a role, such as `keyword`, `string` or `fn`. `code()` and `terminal()` color those roles from the scene's theme, so a highlighted snippet follows `adaptive()` and `variables()` between light and dark, and the SVG it ends up in is still one file with no JavaScript.

<p align="center">
  <a href="https://github.com/saiashirwad/svjeez/tree/main/examples/code"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/code.svg" width="640" alt="A Fibonacci function morphs between TypeScript, Python, Rust and Go, highlighted by role from the scene's theme." /></a>
  <br /><sub>One function in four languages, highlighted by role</sub>
</p>

Shiki's own tokens carry fixed hex colors. Those ignore the scene's theme, which is why this package emits roles instead.

## Install

```sh
npm i -D @svjeez/code svjeez
```

## Use

```tsx
import { highlight } from "@svjeez/code";
import { render } from "svjeez";
import { code, defaultDark } from "svjeez/extras";

const source = `export const greet = (name: string) => \`hello \${name}\`;`;
const snippet = code(highlight(source, "ts"), { x: 24, y: 24, fontSize: 20, theme: defaultDark });

export default () =>
  render({ width: 640, height: 72, duration: 1, title: "Greeting" }, snippet.node);
```

`highlight(source, lang, options)` returns `CodeTokens`: one array per line, each piece either a bare string for plain text or a `[role, text]` pair. Neighbouring runs of the same role are merged. `highlight()` is synchronous, so a scene stays `export default () => render(...)`.

The options are:

- `tabSize`, the spaces per tab stop. `code()` lays out one column per character, so tabs become spaces. It defaults to 2.
- `grammars`, extra Shiki grammars for languages the package does not bundle.

## Languages

These names, and their aliases, work out of the box: `ts`, `tsx`, `js`, `jsx`, `json`, `css`, `html`, `bash` (also `sh`, `shell`, `zsh`), `python`, `rust`, `go`, `sql`, `yaml`, `md` and `diff`. HTML highlights its embedded CSS and JavaScript, and Markdown highlights the fenced code blocks it can resolve.

For any other language, import its grammar from Shiki and pass it in:

```ts
import toml from "shiki/langs/toml.mjs";

highlight('name = "svjeez"', "toml", { grammars: [toml] });
```

A name that is neither bundled nor passed throws `highlight() does not know the language "…". It knows: …`.

## Roles

`src/scopes.ts` is one table from TextMate scope prefix to role, and the longest matching prefix wins. A token that no row matches is plain. The roles are the ones `svjeez/extras` defines: `plain`, `comment`, `punct`, `keyword`, `fn`, `string`, `number`, `constant`, `type`, `variable` and `tag`, plus `red`, `green`, `yellow` and `cyan` for diffs. A theme that wants a different look changes the colors of its slots, and a theme cannot tell the roles apart if it gives two slots one color.

## Notes

The package runs Shiki's JavaScript regex engine, so there is no WebAssembly to load, and it works on Node 20 and later and in bundlers. Importing it loads the default grammars, which takes a few hundred milliseconds once.
