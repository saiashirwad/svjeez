# @svjeez/icons

Tabler and Lucide icons for svjeez scenes: an `<Icon>` that draws each piece, recolors, scales and moves like any node.

```sh
npm i @svjeez/icons@next svjeez@next
```

```tsx
/** @jsxImportSource svjeez */
import { Icon } from "@svjeez/icons";
import { rocket } from "@svjeez/icons/tabler";
import { scene, span, track } from "svjeez";

export default scene({ size: [128, 128], duration: 2, title: "Rocket" }, () => (
  <Icon
    icon={rocket}
    at={[40, 40]}
    size={48}
    color="#FFFFFF"
    draw={(piece) => track(0).to(1, span(0.2, 0.6).shift(piece * 0.1))}
  />
));
```

Repeated still icons are shared automatically. Import icons by name from `@svjeez/icons/tabler` or `@svjeez/icons/lucide`; unused ones never reach the scene.

[Reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/icons.md)
