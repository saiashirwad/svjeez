# @svjeez/icons

Use Tabler and Lucide icons as SVG paths you can style and animate in a svjeez scene.

```sh
npm i -D @svjeez/icons svjeez
```

```tsx
import { rocket } from "@svjeez/icons/tabler";
import { Icon, draw, render, span } from "svjeez";

export default () => render(
  { width: 128, height: 128, duration: 2, title: "Rocket" },
  <Icon
    icon={rocket}
    x={40}
    y={40}
    size={48}
    stroke="#fff"
    animation={(_, each) => draw(each.stagger(span(0.2, 0.6), 0.1))}
  />,
);
```

Pick named imports from `@svjeez/icons/tabler` or `@svjeez/icons/lucide`. `<Icon>` comes from `svjeez` and renders each piece separately. `IconData` is exported by `svjeez` for your own paths.

[API reference](https://github.com/saiashirwad/svjeez/blob/main/packages/svjeez/skills/svjeez/references/icons.md)
