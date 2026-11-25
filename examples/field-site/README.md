# field-site

Fields: four line charges and the electric field around them, at fields.texoport.in. Drag a charge or the probe; svjeez / TypeGPU (keys `1` `2` `3`) shows one layer on its own; Source shows the scene's own file.

```sh
cd examples/field-site && bunx --bun vite
```

- `scenes/fields.tsx`: the scene. One TypeGPU `<Shader>` draws the field per pixel: equipotential rings, field lines (contours of the stream function) and light running down them. The charges, the probe and its arrow and readout, and the rulers are vectors; the rest of the vector figure is in `scenes/annotations.tsx`.
- Each charge's x and y, and the probe's, are clocks. The vector layer places it with a track over its clocks, and the shader reads the same clocks as inputs; both turn progress into a place with the same `"use gpu"` functions, `across` and `down`. The page drags by setting those clocks, and works out the probe's reading (`scenes/field.ts`) to set the arrow's and the readout's clocks.
- `scenes/annotations.tsx`: the rest of the vector figure. Superposition at the probe (each charge's share as a thin arrow, warm or cool by its sign, and the same shares tip to tail, dashed, ending at the total), a dimension line to the nearest charge with its length in u, the field's two sums typeset with `@svjeez/math`, and a scale of potential in the shader's colors with a marker at the probe's φ. Every moving part rides a clock the page sets in `show()`; the `intro` clock, which the page plays once on mount, draws the figure in.
- `scenes/frame.tsx`: the rulers and the fallback: the equipotentials where the charges start, traced at build time, for the plain SVG and browsers without WebGPU.
- `App.tsx`: the scene (`scene.tsx` mounts it with `mount()` from `svjeez/page`), a button over each charge and the probe (drag, or focus and use the arrow keys), the layer toggle and Source.
