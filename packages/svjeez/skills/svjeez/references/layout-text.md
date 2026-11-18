# Layout and text

Every node has a box, the area it paints with its stroke included, known when the scene compiles. Layout containers read those boxes and place each child; text is laid out with its real font, so its box is exact in every target.

## Containers

```tsx
/** @jsxImportSource svjeez/scene */
import { Align, Grid, Group, Shape, Stack, Text, canvas, circle, enter, rect, ref, scene, span } from "svjeez/scene";
import { sans, theme } from "./style";

const badge = ref("badge");

export default scene({ size: [360, 200], duration: 2, title: "Containers", theme }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Stack direction="row" gap={12} align="center" padding={16}>
      <Shape geometry={circle(14)} fill={theme.blue} />
      <Stack gap={2}>
        <Text font={sans} weight={600} size={14} fill={theme.text}>Ada Lovelace</Text>
        <Text font={sans} size={12} fill={theme.muted}>Analyst</Text>
      </Stack>
    </Stack>
    <Grid columns={3} gap={8} justify="center" at={[16, 80]}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Shape geometry={rect(40 + n * 4, 24, { radius: 6 })} fill={theme.raised} />
      ))}
    </Grid>
    <Align place="bottom-right" inset={16}>
      <Group motion={enter(span(0.2, 0.4), { from: { opacity: 0, scale: 0.8 } })}>
        <Shape ref={badge} geometry={rect(72, 28, { radius: 14 })} fill={theme.raised} />
        <Align to={badge}>
          <Text font={sans} weight={600} size={12} fill={theme.text}>NEW</Text>
        </Align>
      </Group>
    </Align>
  </Group>
));
```

- `<Stack direction="row" | "column" gap align padding>`: children one after another. `align` (`start`, `center`, `end`) places each across the stack: in a row, `end` lines up their bottoms. `padding` is one length or `[across, down]`, inside the stack's box.
- `<Grid columns gap justify align padding>`: rows of `columns` cells; each column is as wide as its widest child, each row as tall as its tallest. `justify` places a child across its cell, `align` down it.
- `<Align to place inset>`: places its children against `to`, which is the canvas (default), a box `{ x, y, width, height }` in the parent's frame, or a ref. `place` names the point of `to` and the same point of each child (`"center"` by default), `inset` moves in from the edges. Against a ref that moves, the children move with it. `<Align>` places itself, so it takes no `at`.
- A child in a container takes no `at` or `anchor`. To nudge it, give it a motion layer with an `offset`. Its `rotate`, `scale` and motion still apply, around where it was placed, since layout reads the box at rest.
- A container is a group: give it `at` and `anchor` to place it, `motion` to move it, `ref` to point at it. `anchor="bottom-left"` on a row of bars keeps their baseline still while they grow.
- Containers cost nothing in the output: they become plain placements.

The nine places, for `anchor`, `origin`, `place` and `radial.across({ center })`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. `anchor` also takes fractions of the box, `[0.5, 1]`, and `origin` a point measured from the box's top-left, `[20, 0]`.

## Placing without a container

`at` puts the node's `anchor` point (top-left by default) at a point of its parent's frame. A `<Group>` is a frame: `at` is where its children's `[0, 0]` goes, unless it has an `anchor`. Circles, ellipses and arcs are drawn around their own `[0, 0]`, so `<Shape geometry={circle(8)} at={[60, 40]} anchor="center" />` centers one on a point. Lines, polygons and paths with no `at` stay where their points are.

`at` also takes an anchor on another node, which it follows when that node moves: `at={card.bottomRight}`, or `at={card.right.map(([x, y]) => [x + 8, y])}` for a point beside it. The node is placed where it sits in the tree, after everything is laid out, so the ref can point at a node drawn later.

## Text

```tsx
<Text font={sans} size={14} lineHeight={1.5} width={280} align="start" fill={theme.muted}>
  Runs are measured with their own face, so <Run weight={600} fill={theme.text}>bold words</Run> and{" "}
  <Run italic>an aside</Run> wrap with the text around them.{"\n"}A line break starts a new line.
</Text>
```

- `font` is a face or a family (see [images-fonts.md](images-fonts.md)); `weight` and `italic` pick a face of the family, and that face must be loaded: the browser never invents a bold.
- `width` wraps at spaces; without it lines break only at line breaks. A word wider than `width` is cut, and check reports `word-cut`. `align` places lines in the column; the box still starts at the column's left.
- `lineHeight` is baseline to baseline in multiples of `size`. Default: the font's own.
- The box runs from the tallest ascent to the deepest descent, so `at` places the top of the text. `anchor="baseline-left"`, `"baseline"` or `"baseline-right"` names a point on the first line's baseline, to line text up with other text or a rule.
- `<Run>` changes `font`, `weight`, `italic`, `fill` and `opacity` for part of a text and inherits the rest from the text around it. A run's `opacity` and `fill` take tracks, which is how words appear one by one without moving.
- A `<Text>` holds strings, numbers and `<Run>`s only. Its words can't change over time: to change a label, crossfade two texts, or `morph` between states that key the same `<Text>` (it crossfades when its words change).
