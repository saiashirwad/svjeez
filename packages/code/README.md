# @svjeez/code

Highlight code at build time. Tokens carry roles such as `keyword` and `string`, so svjeez colors them with the scene’s palette.

```sh
npm i -D @svjeez/code svjeez
```

```ts
import { highlight } from "@svjeez/code";
import { tomorrow, tomorrowNight } from "@svjeez/code/palettes";
import { adaptive, code, render } from "svjeez";

const { theme, css } = adaptive({ light: tomorrow, dark: tomorrowNight });
const tokens = highlight("export const greet = (name: string) => 'hello ' + name;", "ts");
const snippet = code(tokens, { x: 20, y: 16, fontSize: 16, theme });

export default () =>
  render({ width: 680, height: 60, duration: 1, title: "Greeting", css }, snippet.node);
```

Pass the tokens to `code()` or to a highlighted terminal command. Common languages are bundled. Supply additional Shiki grammars through `highlight(source, lang, { grammars })`.

<a href="https://github.com/saiashirwad/svjeez/tree/main/examples/code"><img src="https://raw.githubusercontent.com/saiashirwad/svjeez/main/examples/dist/code.svg" width="540" alt="A function morphs between four languages." /></a>

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/code.md)
