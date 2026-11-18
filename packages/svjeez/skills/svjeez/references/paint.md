# Paint and effects

Paint is a color or a gradient, written as a value and animated by a track like any other.

- **Colors**: `tokens({ light: {…}, dark: {…} })` names each color once with a value per scheme. The SVG follows the viewer's `prefers-color-scheme`; frames and video bake one (`--color-scheme`). A hex string (`"#RRGGBB"` or `"#RRGGBBAA"`) is the same in both. Pass the theme to `scene({ theme })` so every token is declared.
- **Gradients across the box**: `linear.across({ angle, stops })` (degrees clockwise from three o'clock: 0 runs left to right, 90 top to bottom) and `radial.across({ center, stops })` (a place on the box; the last stop reaches the farthest corner). They fit whatever box the node has, text included.
- **Gradients at points**: `linear({ from, to, stops })`, `radial({ center, radius, stops })`, in the node's own frame (a rect's from its top-left, a circle's around its center).
- `stops` are colors spread evenly, or `[offset, color]` pairs from 0 to 1. A track blends colors into colors and gradients into gradients of the same kind (stops may differ in number); a color blends into a gradient; a linear and a radial don't blend.
- **Nothing is inherited**: every `<Shape>` and `<Text>` names its own paint.

## Clip, mask, effects

All three are in the node's own frame, so they move, turn and scale with it, and they never change its box. An effect's lengths scale with the node too: a blur or a shadow's offset on a node scaled by 2 is twice as long. A node is drawn, then clipped, then masked, then each effect applies in order, then it is placed and its layers fade it.

```tsx
<Group clip={track(circle(0)).to(circle(260), span(0.3, 1.2), ease.inOut)}>…</Group>

<Text
  font={sans} weight={600} size={30}
  fill={linear.across({ stops: [theme.blue, theme.magenta] })}
  mask={<Shape geometry={rect(360, 60)} at={track<Vec>([-360, -10]).to([0, -10], span(1, 1))} fill={soft} />}
>
  Paint and masks
</Text>

<Shape geometry={card} fill={theme.surface} effects={[shadow({ color: "#000000", opacity: 0.3, offset: [0, 6], blur: 8 })]} />
```

- `clip` is a geometry, or a track of them: only what lies inside is drawn. A clip has no `at`: a circle clip is centered on the node's `[0, 0]` (a group's origin, a rect's top-left corner).
- `mask` is a node: the masked node shows where the mask is opaque, by alpha only, so the mask's colors don't matter. It is laid out in the node's frame and never shown. A soft edge is a gradient from `"#000000"` to `"#00000000"`.
- `effects` takes `blur(radius)` and `shadow({ color, offset, blur, opacity })`; every length can be a track. A shadow is the drawing's alpha in `color`, moved, blurred and laid under it.
- `subtract(base, ...cuts)` cuts holes into one outline: a ring is `subtract(circle(30), circle(20))`. Each cut lies wholly inside the base or wholly outside it.
- A stroke: `stroke={{ color, width, cap: "butt" | "round" | "square", join: "miter" | "round" | "bevel", dash: [6, 4], nonScaling }}`. `trim={[from, to]}` draws part of the outline, fractions of its length; a fill is never trimmed.

The whole example is [`examples/reveal.tsx`](../examples/reveal.tsx).

## What each target can draw

Every backend declares what it supports, and `svjeez check` reports the difference as a finding, never silently. The SVG backend draws everything above. `blur` and `shadow` are reported as `approximate` in SVG: WebKit draws a blur under about 1.5 units softer than it is, while Chromium and Firefox draw it exactly. Keep them if that is fine, or leave them out where the scene must be exact. Frames and video render the SVG in Chromium, so they match it.
