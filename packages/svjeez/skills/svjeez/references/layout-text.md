# Layout and text

Every node has a box, the area it paints with its stroke included, known when the scene compiles. Containers read those boxes and place each child; text is laid out with its real font, so its box is exact in every target.

## Containers

```tsx
<Align place="bottom-right" inset={16}>
  <Center width={72} height={28} radius={14} fill={theme.raised} motion={enter(span(0.2, 0.4), { from: { scale: 0.8 } })}>
    <Text font={sans} weight={600} size={12} fill={theme.text}>NEW</Text>
  </Center>
</Align>
<Stack direction="row" gap={12} align="center" padding={16} radius={12} fill={theme.surface}>…</Stack>
<Grid columns={3} gap={8} justify="center" at={[16, 80]}>…</Grid>
```

- `<Stack direction="row" | "column" gap align justify padding width height>`: children one after another. `align` (`start`, `center`, `end`, or a fraction 0 to 1) places each across the stack; `stretch` makes each container child as wide as the stack's inside. `width` and `height` fix the stack's size, and `justify` (`start`, `center`, `end`, a fraction, or a function `(free, count) => offsets` such as `spread`) spends the room left along it: a label left and a switch right is `<Stack direction="row" justify={spread} width={300}>`. `padding` is one length or `[across, down]`. A stack too small for its children says how much they need.
- `<Center padding width height>`: lays its children over each other, each centered on the others: a label on a shape, a pill.
- `<Grid columns gap justify align padding>`: rows of `columns` cells; each column as wide as its widest child, each row as tall as its tallest. `justify` places a child across its cell, `align` down it.
- `<Align to place inset>`: places its children against `to`: the canvas (default), a box `{ x, y, width, height }` in the parent's frame, or a ref (it follows that node as it moves). `place` names the point of `to` and the same point of each child (`"center"` by default); `inset` moves in from the edges. It places itself, so it takes no `at` or `anchor`.
- `<Stack>`, `<Grid>` and `<Center>` draw a backdrop: `fill`, `stroke={{ color, width }}` and `radius` (a number or four corners) paint a rect exactly as big as the container, sized to its content unless `width` and `height` say otherwise. The stroke counts in the box. The rect is the part `"background"` (a child may not use that key).
- A child in a container takes no `at` or `anchor`. To nudge it, give it a layer with an `offset`. Its `rotate`, `scale` and motion apply around where it was placed, since layout reads the box at rest.
- A container is a group: give it `at` and `anchor` to place it (`anchor="bottom-left"` on a row of bars keeps their baseline still while they grow), `motion` to move it, `ref` to point at it. A container around a `morph()` reflows with it ([morph.md](morph.md)). Containers cost nothing in the output beyond placements and their backdrop rect.

The nine places, for `anchor`, `place` and `radial.across({ center })`: `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. `anchor` also takes fractions `[0.5, 1]`; `origin` takes a place, a point from the box's top-left, or `"at"`.

## Placing without a container

`at` puts the node's `anchor` point (top-left by default) at a point of its parent's frame, on every node. A node with no `at` stays where its coordinates put it: circles, ellipses and arcs are drawn around their own `[0, 0]`, lines, polygons and paths stay on their points. `<Shape geometry={circle(8)} offset={[60, 40]} />` centers one on a point. `offset` is the other way to place any node (Shape, Text, Picture, Group, a container): it moves the node's own `[0, 0]` there (a point, a track or an anchor), so a `<Group>` frame keeps its children's coordinates and a circle needs no `anchor`. A text's `[0, 0]` is the top-left of its first line. `offset` takes no `at` or `anchor`, and a container's child takes neither.

## Text

```tsx
<Text font={sans} size={14} lineHeight={1.5} width={280} align="start" fill={theme.muted}>
  Runs are measured with their own face, so <Run weight={600} fill={theme.text}>bold words</Run> and{" "}
  <Run italic>an aside</Run> wrap with the text around them.{"\n"}A line break starts a new line.
</Text>
```

- `font`, `size` and `fill` are on every text: nothing is inherited and there is no default font. `font` is a face or a family ([fonts-pictures.md](fonts-pictures.md)); `weight` and `italic` pick a face of the family, and that face must be loaded.
- `width` wraps at spaces; without it lines break only at line breaks. A word wider than `width` is cut (`word-cut`). `align` (`start`, `center`, `end`) places lines in the column. `lineHeight` is baseline to baseline in multiples of `size`.
- The box runs from the tallest ascent to the deepest descent, so `at` places the top of the text; `anchor="baseline"`, `"baseline-left"` or `"baseline-right"` names a point on the first line's baseline.
- `<Run>` changes `font`, `weight`, `italic`, `fill` and `opacity` for part of a text and inherits the rest. A run's `opacity` and `fill` take tracks. A `<Run>` outside a `<Text>` throws.
- `stroke` (the same `StrokeProps`; `under: true` draws it below the fill) counts in the box. `size` is a plain number: to grow text, use `scale` or a layer.
- `along={circle(40)}` sets one line along any geometry (no `width`); `start` is a fraction of the path's length, a number or track, and `align` is relative to it.
- A `<Text>` holds strings, numbers, `<Run>`s, or one `count()`. Its words can't change over time: crossfade two texts, or `morph` between states that key the same `<Text>`.

## Numbers that count

```tsx
<Text font={sans} weight={600} size={28} fill={theme.text}>${count(track(0).to(1284500, span(0.5, 2)))}</Text>
<Text font={sans} size={14} fill={theme.text}>{count(track(0).to(9.5, span(0, 1.5)), { format: numeral({ decimals: 1, point: ",", separator: "." }) })} km</Text>
```

`count(value, { format?, rate? })` shows a number, a track or a derived value at every moment. `format` is any `(n: number) => string`, such as `(n) => `$${(n / 1000).toFixed(1)}K``, `(n) => `${n}%``, or `mm:ss` from seconds; the default is `numeral()`. `numeral({ decimals, separator, point, pad })` is the built-in: `decimals` (0), `separator` between thousands (`","`; `""` for none), `point` (`"."`) and `pad` (fewest integer digits, zero-filled). `rate` (30) is the most changes a second. Strings before and after go with it. A counting `<Text>` draws one line in one style: one `count()`, no `<Run>`s, no `width`. Digits sit in slots as wide as the widest digit, so the number doesn't jitter; `align="end"` keeps the right edge still. A long fast count costs bytes: keep the span short or lower `rate`. In a morph, key the text in every state with the same `count()`.
