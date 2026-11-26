# `@svjeez/icons`

Vector icons from Tabler (6,200+ outline + `*Filled` solid icons) and Lucide (2,100+ outline icons) as svjeez `<Shape>` nodes.

## Setup

```sh
npm install @svjeez/icons svjeez
```

- Import `<Icon>` from `@svjeez/icons` and icon data from `@svjeez/icons/tabler` or `@svjeez/icons/lucide`.
- No fonts, network, or runtime config required.

## Mental model

- **Icon data, not string names:** Each export is `{ grid: 24, kind: "outline" | "solid", paths: string[] }`. You can also pass custom `IconData` whose `paths` start with `M`/`m`.
- **Single `color` paint prop:** Outline icons are stroked with `color`; solid icons (`*Filled`) are filled with `color`. `color` accepts theme tokens or `track<Paint>(...)`. There is no `fill` or `strokeWidth` prop.
- **`stroke` and `draw` are outline-only:** `stroke={{ width }}` is in the icon's 24-grid units (default `2`, scaled by `size / grid`). `draw` takes `Anim<number>` (all strokes together) or `(piece, pieces) => Anim<number>` to stagger strokes. Passing `draw` or `stroke` on a solid icon throws; animate solid icons with `motion={enter(...)}`.
- **Naming:** Kebab-case names become camelCase (`arrow-right` → `arrowRight`). Reserved words or digit-prefixed names get an `icon` prefix (`iconFunction`, `iconSwitch`). Tabler uses `playerPlay`/`playerPause` and `*Filled` variants; Lucide is outline-only and uses `play`/`pause`.
- **Layout and morph:** `<Icon>` wraps keyed `<Shape key="piece-N">` nodes in a `<Group>` taking all `Common` props (`at`, `offset`, `motion`, `ref`, `key`). `morph()` works between two `<Icon>`s with the same path count; otherwise cross-fade with `enter`/`exit`.

## API map

| Entry | Exports |
|---|---|
| `@svjeez/icons` | `<Icon icon color size? stroke? draw? ...Common>`, types `IconProps`, `IconData`, `IconDraw` |
| `@svjeez/icons/tabler` | Outline + `*Filled` + `brand*` `IconData` constants |
| `@svjeez/icons/lucide` | Outline `IconData` constants |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { Icon } from "@svjeez/icons";
import { bell, circleCheck, heartFilled, rocket } from "@svjeez/icons/tabler";
import { Group, Shape, Stack, ease, enter, scene, span, tokens, track } from "svjeez";

const theme = tokens({
  light: { background: "#FFFFFF", blue: "#0A6CFF", red: "#D1242F" },
  dark: { background: "#090A0C", blue: "#64D2FF", red: "#FF6B6B" },
});

const outlines = [rocket, bell, circleCheck];

export default scene(
  { size: [320, 110], duration: 3, title: "Icons draw", desc: "Three outline icons draw stroke by stroke, then a solid heart pops in.", theme, still: 2.9, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Stack direction="row" gap={24} at={[40, 24]}>
        {outlines.map((icon, i) => (
          <Icon
            key={`o${i}`}
            icon={icon}
            size={48}
            color={theme.blue}
            stroke={{ width: 1.75 }}
            draw={(piece) => track(0).to(1, span(0.2, 0.6).shift(i * 0.3 + piece * 0.2), ease.inOut)}
          />
        ))}
        <Icon icon={heartFilled} size={48} color={theme.red} motion={enter(span(1.6, 0.5), { from: { scale: 0.3 }, curve: ease.pop })} />
      </Stack>
    </Group>
  ),
);
```

## Gotchas

- `Export named 'play' not found in '@svjeez/icons/tabler'` → Tabler names media icons `playerPlay`/`playerPause` (Lucide has `play`).
- `<Icon> is given a draw/stroke, but its icon is solid` → Use `motion={enter(...)}` on `*Filled` icons, or switch to an outline icon.
- `Property 'fill' does not exist on type 'IconProps'` → Use `color` (and `stroke={{ width }}` instead of `strokeWidth`).
- `morph()` fails with mismatched unkeyed/piece counts between two icons → Morph only icons with the same `paths.length`, or cross-fade two icons with `enter`/`exit`.
- Stroke looks thicker than expected at large `size` → `stroke.width` is in 24-grid units and scales by `size / 24`.
