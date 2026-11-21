# shader-site

One full-window scene of a low-poly valley, from dawn to night. TypeGPU `<Shader>`s draw the sky, the faceted ridges and the lake; the sun, the ridges' outlines, their reflections, the stars and a small flock of birds are vectors. A range input moves the scene's `hour` clock, and shaders and vectors follow it together.

```sh
cd examples/shader-site && bunx --bun vite
```

- `scenes/valley.tsx`: the scene. Each `<Shader>` has a vector fallback for the plain SVG and browsers without WebGPU.
- `scenes/palette.ts`: the colors of dawn, day, dusk and night, as tracks for the vectors and as functions for the shaders.
- `scenes/lattice.ts`: the irregular triangles the shaders cut the ridges and the water into.
- `scenes/birds.tsx`: the flock.
- `App.tsx`: `<Scene>` from `@svjeez/react` and the range input.
