# @svjeez/icons

Tabler and Lucide icons as `<Icon>` nodes for `svjeez`. Recolor, scale, move, or animate each stroke piece with `draw`.

```sh
npm i @svjeez/icons@next svjeez@next
```

```tsx
import { Icon } from "@svjeez/icons";
import { rocket } from "@svjeez/icons/tabler";
import { Align, scene, span, track } from "svjeez";

export default scene({ size: [128, 128], duration: 2, title: "Rocket" }, () => (
  <Align>
    <Icon
      icon={rocket}
      size={48}
      color="#FFFFFF"
      draw={(piece) => track(0).to(1, span(0.2, 0.6).shift(piece * 0.1))}
    />
  </Align>
));
```

- Import icons by name from `@svjeez/icons/tabler` or `@svjeez/icons/lucide`; unused icons are not bundled into the scene.
- Identical static icons are deduplicated automatically in the emitted SVG.

[API reference](https://github.com/saiashirwad/svjeez/blob/next/packages/svjeez/skills/svjeez/references/icons.md)
