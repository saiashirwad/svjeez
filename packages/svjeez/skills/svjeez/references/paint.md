# Paint, clip, mask and effects

Paint is a color or a gradient, written as a value and animated by a track like any other.

- **Colors**: `tokens({ light: {…}, dark: {…} })` names each color once with a value per scheme. The SVG follows the viewer's `prefers-color-scheme`; frames and video bake one (`--color-scheme`). A hex string (`"#RRGGBB"` or `"#RRGGBBAA"`) is the same in both. Pass the theme to `scene({ theme })`. `mix(a, b, share)` blends two colors; `alpha(color, a)` sets opacity on a hex or token (blended live on tokens).
- **One scheme only**: `scheme="light"` or `scheme="dark"` on any node shows it only in that scheme (plain CSS: `display:none` under the other `prefers-color-scheme`); without it a node shows in both. Use it where the two schemes draw different things, not just different colors (a sun by day, a moon by night). A hidden node still takes its space in a `<Stack>` or `<Grid>`, since both schemes share one layout: put the two alternatives in a `<Group>` so they overlap, as in `<Group><Sun scheme="light" /><Moon scheme="dark" /></Group>`. `check` judges each node in the schemes it shows in.
- **Gradients across the box**: `linear.across({ angle, stops })` (degrees clockwise from three o'clock: 0 runs left to right, 90 top to bottom) and `radial.across({ center, fit, stops })` (`center` is a place or fractional `[fx, fy]`; `fit: "cover"` reaches the farthest corner, `fit: "inside"` stays within the inscribed circle so circular glows fade before the edge). They fit whatever box the node has, text included.
- **Gradients at points**: `linear({ from, to, stops })`, `radial({ center, radius, stops })`, in the node's own frame.
- `stops` are colors spread evenly, or `[offset, color]` pairs from 0 to 1. A track blends colors into colors and gradients into gradients of the same kind; a color blends into a gradient; a linear and a radial don't blend.
- **Pattern**: `pattern({ size: [w, h], tile, offset?, rotate? })` repeats a tile of nodes in the painted node's frame; use it as `fill` or a stroke `color`. `offset` is a track for scrolling; `rotate` turns the pattern grid in degrees. It blends with nothing but itself.
- **Nothing is inherited**: every `<Shape>` and `<Text>` names its own paint. `fillOpacity` animates fill opacity independently of `stroke`, so one shape can draw its outline then fade its fill in.

## Stroke

`stroke={{ color, width, cap: "flat" | "round" | "square", join: "sharp" | "round" | "flat", dash: [6, 4], dashOffset, fixedWidth, under }}`. `color` and `width` take tracks. `dashOffset` slides the dash (needs `dash`; not with `draw` or `trim`). `fixedWidth` keeps the width when the node is scaled; `under` draws it below the fill. `draw={0..1}` strokes the outline on; `trim={[from, to]}` shows a window of it; a fill is never trimmed.

## Clip, mask, effects, blend

All are in the node's own frame, so they move, turn and scale with it, and never change its box. A node is drawn, then clipped, masked, passed through each effect in order, then placed.

```tsx
<Group clip={track(circle(0)).to(circle(260), span(0.3, 1.2), ease.inOut)}>…</Group>
<Group clip={(own) => moved(circle(30), own.center)}>…</Group>

<Text font={sans} size={30} fill={theme.text}
  mask={(own) => <Shape geometry={rect(own.width + 60, own.height)}
    at={track<Vec>([-own.width - 60, 0]).to([0, 0], span(1, 1))}
    fill={linear({ from: [own.width, 0], to: [own.width + 60, 0], stops: [[0, "#000000"], [1, "#00000000"]] })} />}>
  Paint and masks
</Text>

<Shape geometry={card} fill={theme.surface} effects={[shadow({ color: "#000000", opacity: 0.3, offset: [0, 6], blur: 8 })]} />
```

- `clip` is a geometry or a track of them: only what lies inside is drawn. A circle is centered on the node's `[0, 0]`; `moved(geometry, [x, y])` puts it anywhere. `clip` and `mask` also take `(own) => …`, where `own` has `x y width height size center rect`: a clip or wipe that fits the node however wide its text turns out. A group so sized must hold nodes placed without anchors.
- `mask` is a node: the masked node shows where the mask is opaque, by alpha only. A soft edge is a gradient from `"#000000"` to `"#00000000"`.
- `effects`: `blur(radius)`, `shadow({ color, offset, blur, opacity })`, `adjust({ saturate, hue, brightness, contrast })`, `displace({ scale, frequency, seed, octaves })`. Every number but `seed` and `octaves` can be a track; a shadow's `color` too. An effect's lengths scale with the node.
- `blend` (`"multiply"`, `"screen"`, `"overlay"`, … `"luminosity"`; `"normal"` by default) composites a node onto its earlier siblings; a group whose children blend is isolated.
- `subtract(base, ...cuts)` cuts holes into one outline: `subtract(circle(30), circle(20))` is a ring. Each cut lies wholly inside the base or wholly outside it, and cuts don't touch each other.
- A moving filter (animated parameters, or content that moves inside it) is redrawn every frame: `check` reports `moving-filter` and counts its area under `cost.repaint`. A blur or shadow under about 1.5 units is `approximate` in WebKit.

The whole example is [`examples/reveal.tsx`](../examples/reveal.tsx).
