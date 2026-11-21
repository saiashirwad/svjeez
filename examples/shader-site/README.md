# shader-site

One full-window scene of a low-poly valley, from dawn to night. TypeGPU `<Shader>`s draw the sky, the faceted ridges and the lake; the sun, the ridges' outlines, their reflections, the stars and a small flock of birds are vectors. A range input moves the scene's `hour` clock, and shaders and vectors follow it together.

```sh
cd examples/shader-site && bunx --bun vite
```

- `scenes/valley.tsx`: the scene. Each `<Shader>` has a vector fallback for the plain SVG and browsers without WebGPU.
- `scenes/palette.ts`: the colors of dawn, day, dusk and night, as tracks for the vectors and as functions for the shaders.
- `scenes/lattice.ts`: the irregular triangles the shaders cut the ridges and the water into.
- `scenes/birds.tsx`: the flock.
- `scenes/svjeez-logo.tsx`: Blip, the svjeez mascot (copied from the site into `scenes/blip.tsx`), linking to svjeez. Its eyes follow the sun across the slider; hovering or focusing the link makes it hop.
- `scenes/typegpu-logo.tsx`: TypeGPU's logomark, linking to TypeGPU. Its two paths and their gradients are read from `assets/typegpu.svg` at build; hovering or focusing the link lifts it a little. The file is TypeGPU's own, from https://docs.swmansion.com/TypeGPU/_astro/typegpu-logomark-light.C0z0iSBF_1EkzPP.svg.
- `scenes/heart.tsx`: the heart between them, which beats quicker while either is hovered.
- `App.tsx`: `<Scene>` from `@svjeez/react` for each scene, the range input, and the links around the two logos.
