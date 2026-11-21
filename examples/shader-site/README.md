# shader-site

One scene, a sky and a lake drawn by two inline TypeGPU `<Shader>`s with a vector sun and hills over them. A range input moves the scene's `hour` clock, and shaders and vectors follow it together.

```sh
cd examples/shader-site && bunx --bun vite
```

- `scenes/dusk.tsx`: the scene. Each `<Shader>` has a vector fallback for the plain SVG and browsers without WebGPU.
- `scenes/theme.ts`: light and dark colors as tokens.
- `App.tsx`: `<Scene>` from `@svjeez/react` and the range input.
