# `@svjeez/math`

Typeset MathJax TeX formulas (`<Tex>`), plot functions and linear maps on coordinate planes (`plane()`, `<Axes>`), and draw straightedge-and-compass constructions.

## Setup

```sh
npm install @svjeez/math svjeez
```

- `mathjax-full` is bundled; `<Tex>` emits vector glyph outlines with no font or network needed.
- `<Axes labels={{ font, ... }}>` and prose `<Text>` still require a loaded font.

## Mental model

- **Always pass TeX as one `String.raw` child:** Regular JS strings eat `\f` (`\frac`) and `\a` (`\alpha`). Write `` <Tex size={48} fill={theme.text}>{String.raw`\frac{a}{b}`}</Tex> ``.
- **Glyph-level morphing, colors, and named parts:**
  - `<Tex>` emits one keyed `<Shape>` per glyph, so `morph(<Tex>A</Tex>, <Tex>B</Tex>, span)` slides shared glyphs to their new positions.
  - Color sub-expressions with `\textcolor{name}{...}` plus `colors={{ name: theme.blue }}`.
  - Name sub-expressions with `\cssId{name}{...}`: inspect sizes ahead of time via `Tex.measure(src, { size }).part("name")`, and pin callouts with `ref()` (`eq.part("name").bottom` + `at` + `anchor="top"`).
  - `draw={track(0).to(1, span(...))}` strokes each glyph on then fills it.
- **Coordinate planes (`plane()`):** Math coordinates have **y up**. `plane({ x: [min, max], y: [min, max], size: [w, h] })` returns pure geometry builders (`plot`, `parametric`, `area`, `riemann`, `tangent`, `secant`, `vector`, `polygon`, `segment`, `grid`, `axes`). Place `<Axes plane={p} ... />` and plotted `<Shape>`s inside the same `<Group offset={[x, y]}>`.
- **Linear transformations:** `const shear = base.transform([[1, 0.4], [0, 1]])` preserves grid/polygon topology so `track(base.grid(1)).to(shear.grid(1), span)` tweens smoothly.
- **Constructions are in pixel space (y down):** `compass`, `crossings`, `meet`, `midpoint`, `angle`, `rightAngle`, `brace`, `ticks`, `foot`, `bisect`, `extend`, `distance` operate on pixel `Vec`s. Positive `compass` `sweep` is clockwise on screen; convert plane coordinates with `p.point([x, y])`.

## API map

| Category | Exports |
|---|---|
| TeX | `<Tex size fill display? anchor? colors? draw? ...Common>`, `Tex.measure(src, { size, display?, anchor? })` |
| Plane & axes | `plane({ x, y, size })` (`.point`, `.plot`, `.parametric`, `.area`, `.riemann`, `.slope`, `.tangent`, `.secant`, `.vector`, `.polygon`, `.segment`, `.grid`, `.axes`, `.transform`), `<Axes plane stroke ticks? grid? labels? />` |
| Constructions | `angle`, `bisect`, `brace`, `compass`, `crossings`, `distance`, `extend`, `foot`, `meet`, `midpoint`, `rightAngle`, `ticks` |

## Verified snippet

```tsx
/** @jsxImportSource svjeez */
import { Axes, Tex, plane } from "@svjeez/math";
import { google } from "@svjeez/fonts";
import { Group, Shape, ease, scene, span, tokens, track } from "svjeez";

const mono = await google("JetBrains Mono", { fallback: ["ui-monospace", "monospace"], ligatures: false });
const theme = tokens({
  light: { background: "#FFFFFF", text: "#111111", border: "#6B7280", muted: "#555A66", blue: "#0A6CFF", red: "#D1242F" },
  dark: { background: "#090A0C", text: "#F5F5F7", border: "#8B949E", muted: "#98A0AD", blue: "#64D2FF", red: "#FF6B6B" },
});

const f = (x: number) => Math.sin(x) + 0.3 * x;
const graph = plane({ x: [-1, 7], y: [-2, 4], size: [400, 240] });
const sum = graph.riemann(f, { from: 0, to: 6, n: 8, at: 0.5 });

export default scene(
  { size: [460, 360], duration: 4.5, title: "Integral plot", desc: "A curve draws on axes with Riemann bars and a tangent line.", theme, still: 4.4, loop: false },
  (canvas) => (
    <Group>
      <Shape geometry={canvas.rect} fill={theme.background} />
      <Group offset={[40, 90]}>
        <Axes
          plane={graph}
          ticks={[1, 2]}
          stroke={{ color: theme.muted, width: 1 }}
          grid={{ color: theme.border, width: 0.5 }}
          labels={{ font: mono, size: 12, fill: theme.muted }}
        />
        {sum.bars.map((bar, i) => (
          <Shape key={`bar${bar.key}`} geometry={bar.geometry} fill={theme.blue} opacity={track(0).to(0.35, span(1.4 + i * 0.1, 0.3))} />
        ))}
        <Shape geometry={graph.plot(f)} stroke={{ color: theme.text, width: 2.5, cap: "round", join: "round" }} draw={track(0).to(1, span(0.2, 1.1), ease.inOut)} />
        <Shape geometry={graph.tangent(f, 3, { length: 120 })} stroke={{ color: theme.red, width: 2, cap: "round" }} draw={track(0).to(1, span(2.8, 0.6))} />
      </Group>
      <Tex size={22} at={[40, 20]} fill={theme.text} draw={track(0).to(1, span(0.2, 1.2))}>
        {String.raw`\int_0^6 f(x)\,dx \approx ${sum.sum.toFixed(2)}`}
      </Tex>
    </Group>
  ),
);
```

## Gotchas

- `<Tex> can't read "\frac{a}{b}": null is not an object` → Use `` String.raw`\frac{a}{b}` `` so JS does not strip backslashes.
- `<Tex> colors part … with \color{hot}, which its colors don't name` → Pass `colors={{ hot: theme.blue }}` on `<Tex>`.
- `<Tex> can't place "… \tag{1}"` → Omit `\tag` and full-width environments like `\begin{align}`.
- Axis labels render bold/colored when stroked Riemann bars share the same `<Group>` → Omit `stroke` on Riemann bars (use `fill` + `opacity`), or place `<Axes>` in a sibling `<Group>`.
- `plane.vector()` draws nothing with `stroke` → `vector()` returns a filled arrow polygon; pass `fill` (use `stroke: { width }` option inside `vector()` to size the shaft).
- `<Align to={eq.part("x")} place="bottom">` overlaps the formula → Pin outside with `at={eq.part("x").bottom}` and `anchor="top"` on the child instead.
- `plot() draws nothing: the function stays outside y [...]` → Widen `plane`'s `y` range or adjust `from`/`to`.
