# Page HTML and WebGPU shaders: `<Slot>` and `<Shader>`

## `<Slot>`: a box for the page's own HTML

`<Slot name="field" width={w} height={h}>{fallback}</Slot>` is a box of w by h that lays out like a `<Center>` and draws its children as the fallback: what the plain `.svg`, an `<img>` and a page with no JS or GPU show. It is written as `<g data-slot="field" data-slot-box="x y w h">` (the box in the group's own units).

```ts
import { mount } from "svjeez/page";

const scene = mount(document.querySelector("#card svg")!);
const release = scene.slot("field").host(canvas); // the canvas sits over the box; release() gives the fallback back
```

`host(node)` puts an HTML node (a canvas, a video) in a `<foreignObject>` over the box, so layout, motion and clocks move it, and hides the fallback. `slot(name)` also gives `element` and `box`, and throws listing the slot names when there is none. A name is letters, digits, - and _; each slot has its own. Safari draws a `<foreignObject>` under transforms with known quirks, so keep the fallback presentable.

## `<Shader>`: a slot drawn by WebGPU

A `<Shader>` is a `<Slot>` that the page draws with a WebGPU shader written right in the scene, in [TypeGPU](https://docs.swmansion.com/TypeGPU). The build turns the function into WGSL and writes it into the SVG; `mount()` from `svjeez/page` draws it every frame until `unmount()`. Its children are the fallback for the plain `.svg`, an `<img>` and a browser without WebGPU.

```tsx
import { d, std } from "typegpu";

const storm = clock("storm", span(1, 1.5));
const card = ref();

<Shader
  name="sky"
  width={520}
  height={220}
  clip={rect(520, 220, { radius: 12 })}
  inputs={{ storm, focus: card.center, ground: theme.blue }}
  fragment={(uv, input) => {
    "use gpu";
    const glow = std.exp(-std.distance(std.mul(uv, input.resolution), input.focus) * 0.01);

    return d.vec4f(std.mix(input.ground, d.vec3f(1, 0.6, 0.2), glow * input.storm), 1);
  }}
>
  <Still />
</Shader>;
```

- Install `typegpu` and `unplugin-typegpu` (`npm i typegpu; npm i -D unplugin-typegpu`). `svjeez` and `@svjeez/vite` compile `"use gpu"` functions when they are installed; importing `svjeez` never loads either. Without them, `<Shader>` throws a SceneError that says what to install. Under Node the transform needs `module.registerHooks` (Node 22.15 or later); on an older Node, `<Shader>` throws a SceneError that says so.
- `fragment(uv, input)` starts with `"use gpu"` and returns a `d.vec4f`. `uv` runs 0 to 1 from the box's top left, y down, so `uv * input.resolution` is the pixel. It runs on the GPU, so it may use only `d`, `std`, other `"use gpu"` functions (keep helpers at module level) and constants (numbers, vectors) from outside; a plain JS function fails with TypeGPU's own message, named by the node.
- `input` is typed from `inputs`: `input.time` (f32, seconds) and `input.resolution` (vec2f, device pixels) always, then each input by name. A clock is its progress 0 to 1 (f32); a number is an f32; `[x, y]` is a vec2f; an anchor (`card.center`) is a vec2f in canvas pixels from the slot's top left, where the layout rests it, and does not follow it when it moves on a clock; a color or theme token is a vec3f that is the light or dark value of the viewer's scheme. Names are letters, digits and `_`.
- The group is `<g data-slot="sky" data-slot-box="x y w h" data-shader-inputs='{"size":48,"fields":[{"name":"storm","kind":"clock","at":16}, …]}'>` with a `<script type="text/wgsl">` first. One uniform struct at `@group(0) @binding(0)` holds time, resolution, then the inputs in the order given, at WGSL offsets (`at` is bytes). The entries are `svjeez_vertex` and `svjeez_fragment`.
- The runner makes a canvas the size of the box in device pixels, at most 1.5 million of them (a bigger box draws at a lower density), hosts it in the slot, and draws while the slot is on screen. Every shader on the page shares one GPU device and one animation frame, and is handed to the GPU in one submit. Under reduced motion time stays 0 and it draws only when a clock moves. On unmount it stops, and the last shader to stop frees the device. With no WebGPU, or any failure (a shader that does not compile), it keeps the fallback and logs nothing.
- Needs WebGPU in the page. Under Bun, a bunfig `preload` that handles every source file (as `@svjeez/dom/bun/preload` does) must come after `loadTypeGpu(dir)` from `svjeez/tools`, which installs the transform; Bun runs one plugin per file, so pass `{ include }` (a regular expression on the path) to keep the transform to the modules that have a `"use gpu"` function. Worked example: `examples/gpu-card`.
