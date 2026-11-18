# Layout and text

Every node has a box, the area it paints with its stroke included, known when the scene compiles. Layout containers read those boxes and place each child; text is laid out with its real font, so its box is exact in every target.

## Containers

```tsx
/** @jsxImportSource svjeez */
import { Align, Center, Grid, Group, Shape, Stack, Text, canvas, circle, enter, rect, scene, span } from "svjeez";
import { sans, theme } from "./style";

export default scene({ size: [360, 200], duration: 2, title: "Containers", theme }, () => (
  <Group>
    <Shape geometry={canvas.rect} fill={theme.background} />
    <Stack direction="row" gap={12} align="center" padding={16} radius={12} fill={theme.surface}>
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
      <Center width={72} height={28} radius={14} fill={theme.raised} motion={enter(span(0.2, 0.4), { from: { opacity: 0, scale: 0.8 } })}>
        <Text font={sans} weight={600} size={12} fill={theme.text}>NEW</Text>
      </Center>
    </Align>
  </Group>
));
```

- `<Stack direction="row" | "column" gap align justify padding width height>`: children one after another. `align` (`start`, `center`, `end`, `stretch`) places each across the stack: in a row, `end` lines up their bottoms; `stretch` makes each container child as wide (or tall) as the stack's inside. `width` and `height` fix the stack's size, and `justify` (`start`, `center`, `end`, `space-between`) spends the room left along it: a label left and a switch right is `<Stack direction="row" justify="space-between" width={300}>`. `padding` is one length or `[across, down]`, inside the stack's box. A stack too small for its children says how much they need.
- `<Center padding width height>`: lays its children over each other, each centered on the others. A label on a shape is `<Center><Shape …/><Text>…</Text></Center>`; a pill is `<Center width={64} height={24} radius={12} fill={…}><Text>…</Text></Center>`.
- `<Stack>`, `<Grid>` and `<Center>` draw themselves: `fill`, `stroke={{ color, width }}` and `radius` (one number or four corners) paint a rect exactly as big as the container, under its children, sized to its content unless `width` and `height` say otherwise. The stroke counts in the box and its padding, so a child never sits under it; a full-width title bar in a window is a child of `<Stack align="stretch" stroke={…}>` with corners `radius - width / 2`. The rect is the part `"background"`, and a timeline's `fill` and `stroke` on the container's ref recolor it.
- `<Grid columns gap justify align padding>`: rows of `columns` cells; each column is as wide as its widest child, each row as tall as its tallest. `justify` places a child across its cell, `align` down it.
- `<Align to place inset>`: places its children against `to`, which is the canvas (default), a box `{ x, y, width, height }` in the parent's frame, or a ref. `place` names the point of `to` and the same point of each child (`"center"` by default), `inset` moves in from the edges. Against a ref that moves, the children move with it. `<Align>` places itself, so it takes no `at`.
- A child in a container takes no `at` or `anchor`. To nudge it, give it a motion layer with an `offset`. Its `rotate`, `scale` and motion still apply, around where it was placed, since layout reads the box at rest.
- A container is a group: give it `at` and `anchor` to place it, `motion` to move it, `ref` to point at it. `anchor="bottom-left"` on a row of bars keeps their baseline still while they grow.
- Containers cost nothing in the output: they become plain placements, plus one rect for one that draws itself.
- A container around a `morph()` reflows with it: see [morph.md](morph.md).

The nine places, for `anchor`, `origin`, `place` and `radial.across({ center })`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. `anchor` also takes fractions of the box, `[0.5, 1]`, and `origin` a point measured from the box's top-left, `[20, 0]`, or `"at"`, the point `at` (or `offset`) places: a gear drawn around its group's `[0, 0]` turns about its axle with `<Group offset={axle} rotate={…} origin="at">`.

## Placing without a container

`at` puts the node's `anchor` point (top-left by default) at a point of its parent's frame. It means that on every node: a `<Group>`'s or `<Instance>`'s `at` places the box of what it holds. A node with no `at` is not moved: it stays where its coordinates put it. Circles, ellipses and arcs are drawn around their own `[0, 0]`, so `<Shape geometry={circle(8)} at={[60, 40]} anchor="center" />` centers one on a point, and `<Shape geometry={circle(8)} />` sits centered on `[0, 0]`; lines, polygons and paths stay on their points; a stroke grows the box both ways and moves nothing. `anchor` without `at` is an error, unless a verb moves the node.

To use a `<Group>` or `<Instance>` as a frame, give it `offset`: where its children's `[0, 0]` goes, a point, a track or an anchor such as `card.center`. `offset` takes no `at` or `anchor`; a verb that moves `at` on such a node moves its `offset`. `move()` on a node with no `at` starts from where its box is.

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
- A `<Text>` holds strings, numbers and `<Run>`s, or one `count()` (below). Its words can't change over time: to change a label, crossfade two texts, or `morph` between states that key the same `<Text>` (it crossfades when its words change).

## Numbers that count

`count(value, format?)` inside a `<Text>` shows a number that changes: `value` is a number, a track or a derived value, and the text shows it at every moment, rounded to its `decimals`.

```tsx
<Text font={sans} weight={600} size={28} fill={theme.text}>
  ${count(track(0).to(1284500, span(0.5, 2), ease.out))}
</Text>
<Text font={sans} size={12} fill={theme.muted} align="end">
  {count(progress.map((p) => p * 100))}%
</Text>
<Text font={sans} size={14} fill={theme.text}>
  {count(track(0).to(9.5, span(0, 1.5)), { decimals: 1, point: ",", separator: "." })} km
</Text>
```

- Format: `decimals` (default `0`), `separator` between thousands (default `","`, `""` for none, `" "` for a space), `point` before the decimals (default `"."`), `pad` (the fewest integer digits, filled with zeros: `pad: 2` shows `07`), and `rate` (default `30`), the most times a second the number changes. A slow count changes exactly when its rounded value does.
- Strings before and after the `count()` go with it: `${count(…)}` and `{count(…)}%`. A counting `<Text>` draws one line in one style: no `<Run>`s, no `width`, one `count()`.
- Digits are set in slots as wide as the font's widest digit, so the number doesn't jitter. The box is as wide as the widest number it shows, so a container lays it out once; `align` says which edge holds still when it gains a digit (`start` by default, `end` for numbers lined up on the right).
- Every target shows the same digits at the same time, and the reduced-motion still shows the number at the still's moment. `check --at` prints the number on screen; a looping count that doesn't come back to where it started is a `loop-seam`: `.rewind()` its track, or fade the text out.
- Each digit is a column that steps through the glyphs it shows, a few bytes per change. A count that runs over several seconds at a high rate costs more; keep the counting span short or lower `rate`.
- In a `morph`, a counting `<Text>` keyed in every state keeps the same `count()` in each.
