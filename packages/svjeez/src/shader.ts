/// <reference types="@webgpu/types" />
import type { Mounted } from "./clocks";
import type { ShaderField } from "./model/ir";

interface Table {
  readonly size: number;
  readonly fields: readonly ShaderField[];
}

type Scene = Pick<Mounted, "clocks" | "slot">;

const CANVAS: Partial<CSSStyleDeclaration> = { display: "block", width: "100%", height: "100%" };

const parsed = (group: Element): { readonly table: Table; readonly code: string } | undefined => {
  const code = group.querySelector(':scope > script[type="text/wgsl"]')?.textContent;

  try {
    const table: Table = JSON.parse(group.getAttribute("data-shader-inputs") ?? "");

    return code ? { table, code } : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Draws the WebGPU shader of one `<Shader>` group in its slot: a canvas the size of the box, redrawn every frame while it
 * is on screen. Any failure, or a page without WebGPU, leaves the fallback as the picture.
 */
const run = (group: Element, scene: Scene): (() => void) => {
  const source = parsed(group);
  const name = group.getAttribute("data-slot");

  if (!source || name === null || !navigator.gpu) return () => undefined;

  const { table, code } = source;
  const dark = matchMedia("(prefers-color-scheme: dark)");
  const calm = matchMedia("(prefers-reduced-motion: reduce)");
  const data = new Float32Array(table.size / 4);
  let gone = false;
  let release: (() => void) | undefined;
  let frame = 0;
  let device: GPUDevice | undefined;
  let watcher: IntersectionObserver | undefined;

  const stop = () => {
    gone = true;
    cancelAnimationFrame(frame);
    watcher?.disconnect();
    release?.();
    device?.destroy();
  };

  const start = async () => {
    const adapter = await navigator.gpu.requestAdapter();

    if (!adapter || gone) return;
    const made = await adapter.requestDevice();

    if (gone) return made.destroy();
    device = made;
    // The page's console is not told about a shader that fails: its fallback is the picture.
    made.addEventListener("uncapturederror", (event) => event.preventDefault());
    void made.lost.then(stop);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgpu");

    if (!context) return stop();
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device: made, format, alphaMode: "premultiplied" });
    made.pushErrorScope("validation");
    const module = made.createShaderModule({ code });

    const pipeline = made.createRenderPipeline({
      layout: "auto",
      vertex: { module, entryPoint: "svjeez_vertex" },
      fragment: { module, entryPoint: "svjeez_fragment", targets: [{ format }] },
    });

    const buffer = made.createBuffer({
      size: Math.max(16, table.size),
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindings = made.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });

    if ((await made.popErrorScope()) || gone) return stop();

    Object.assign(canvas, { ariaHidden: "true" });
    Object.assign(canvas.style, CANVAS);
    const slot = scene.slot(name);

    release = slot.host(canvas);

    const clockProgress = (clock: string): number => {
      const found = scene.clocks.get(clock);

      return found ? found.time / found.over : 0;
    };

    const begun = performance.now();
    let visible = true;
    let last = "";

    // What a field holds now, as the numbers the shader reads.
    const valueOf = (field: ShaderField, w: number, h: number): readonly number[] => {
      switch (field.kind) {
        case "time":
          return [calm.matches ? 0 : (performance.now() - begun) / 1000];
        case "resolution":
          return [w, h];
        case "clock":
          return [clockProgress(field.name)];
        case "number":
          return [field.value];
        case "vec":
          return field.value;
        case "point":
          return [field.value[0] * (w / slot.box.width), field.value[1] * (h / slot.box.height)];
        case "color":
          return dark.matches ? field.dark : field.light;
      }
    };

    const draw = () => {
      frame = visible ? requestAnimationFrame(draw) : 0;
      const { width, height } = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(width * devicePixelRatio));
      const h = Math.max(1, Math.round(height * devicePixelRatio));

      if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });

      for (const field of table.fields) data.set(valueOf(field, w, h), field.at / 4);

      // Under reduced motion nothing moves but the clocks: draw only when a value has changed.
      const now = data.join();

      if (calm.matches && now === last) return;
      last = now;

      made.queue.writeBuffer(buffer, 0, data);
      const encoder = made.createCommandEncoder();

      const pass = encoder.beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: [0, 0, 0, 0],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      });

      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindings);
      pass.draw(3);
      pass.end();
      made.queue.submit([encoder.finish()]);
    };

    // An element that is off screen is not drawn: its loop stops until it comes back.
    watcher = new IntersectionObserver((entries) => {
      visible = entries.at(-1)?.isIntersecting ?? true;

      if (visible && frame === 0 && !gone) frame = requestAnimationFrame(draw);
    });

    watcher.observe(canvas);
    frame = requestAnimationFrame(draw);
  };

  start().catch(stop);

  return stop;
};

/** Draws every `<Shader>` in `root` with WebGPU, and returns the function that stops them. */
export const runShaders = (root: Element, scene: Scene): (() => void) => {
  const stops = [...root.querySelectorAll("g[data-shader-inputs]")].map((group) =>
    run(group, scene),
  );

  return () => stops.forEach((stop) => stop());
};
