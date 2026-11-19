# @svjeez/code

Syntax-highlighted code blocks for `svjeez` with typing animations and morphs. Shiki tokenizes at compile time, so the output SVG has no script.

```sh
npm i -D @svjeez/code@next @svjeez/fonts@next svjeez@next
```

```tsx
import { Code } from "@svjeez/code";
import { tomorrow } from "@svjeez/code/palettes";
import { google } from "@svjeez/fonts";
import { Group, Shape, scene, span } from "svjeez";

const mono = await google("JetBrains Mono", { ligatures: false });

export default scene({ size: [360, 80], duration: 3, title: "Greeting", loop: false }, (canvas) => (
  <Group>
    <Shape geometry={canvas.rect} fill={tomorrow.plain} />
    <Code lang="ts" font={mono} size={16} palette={tomorrow} at={[20, 20]} typing={span(0.3, 1.5)}>
      {`export const greet = (name: string) => "hello " + name;`}
    </Code>
  </Group>
));
```

- Built-in palettes in `@svjeez/code/palettes`: `tomorrow`, `solarized`, `gruvbox`, and `rosePine` (each with light and dark modes).
- Define custom palettes with `palette(name, { light, dark })`.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/code.md)
