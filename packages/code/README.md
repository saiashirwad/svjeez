# @svjeez/code

Syntax-highlighted code for svjeez scenes. `<Code>` tokenizes with Shiki while the scene compiles and colors each token from a palette, in light and dark. The SVG carries no script.

```sh
npm i -D @svjeez/code svjeez
```

```tsx
import { Code } from "@svjeez/code";
import { google } from "@svjeez/fonts";
import { tomorrow } from "@svjeez/code/palettes";
import { Group, Shape, canvas, scene, span } from "svjeez";

const mono = await google("JetBrains Mono", { ligatures: false });

export default scene({ size: [360, 80], duration: 3, title: "Greeting", loop: false }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={tomorrow.plain} />
    <Code lang="ts" font={mono} size={16} palette={tomorrow} at={[20, 20]} typing={span(0.3, 1.5)}>
      {`export const greet = (name: string) => "hello " + name;`}
    </Code>
  </Group>
));
```

A `palette` gives one paint per role (`keyword`, `string`, `function`…). `@svjeez/code/palettes` has `tomorrow`, `solarized`, `gruvbox` and `rosePine`, each with a light and a dark ramp, and `palette(name, { light, dark })` makes your own.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/code.md)
