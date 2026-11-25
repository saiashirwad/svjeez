/// <reference types="@webgpu/types" />
import type { Mounted } from "./clocks";
import { isNumber, isObject, isPoint, isString } from "./model/guards";
import type { Rgb, ShaderField } from "./model/ir";
import { slotOf } from "./slots";

interface Table {
  readonly size: number;
  readonly fields: readonly ShaderField[];
}

type Scene = Pick<Mounted, "clocks">;

const CANVAS: Partial<CSSStyleDeclaration> = { display: "block", width: "100%", height: "100%" };

/**
 * The most pixels one canvas draws. A larger box draws at a lower density, up to its size: a shader is redrawn every
 * frame, and a full-window one at the screen's density costs the GPU far more than the eye sees.
 */
const BUDGET = 1_500_000;

interface Shared {
  readonly device: Promise<GPUDevice | undefined>;
  readonly users: Set<() => void>;
}

/** The page's one device, which every shader on it draws with. */
let shared: Shared | undefined;

const opened = async (): Promise<GPUDevice | undefined> => {
  const adapter = await navigator.gpu.requestAdapter();

  if (!adapter) return undefined;
  const device = await adapter.requestDevice();

  device.addEventListener("uncapturederror", (event) => event.preventDefault());

  return device;
};

/** A shader's hold on the page's device: the device, once it is made, and the function that gives it back. */
interface Loan {
  readonly device: Promise<GPUDevice | undefined>;
  readonly back: () => void;
}

/** Borrows the page's device, made on first use; the last shader to give it back destroys it. */
const borrow = (stop: () => void): Loan => {
  const held: Shared = shared ?? { device: opened(), users: new Set() };

  const forget = () => {
    if (shared === held) shared = undefined;
  };

  if (!shared) {
    shared = held;
    held.device.then((device) => {
      void device?.lost.then(() => {
        forget();
        held.users.forEach((release) => release());
      });
    }, forget);
  }

  held.users.add(stop);

  return {
    device: held.device,
    back: () => {
      if (!held.users.delete(stop) || held.users.size > 0) return;
      forget();
      held.device.then((device) => device?.destroy(), forget);
    },
  };
};

/** A shader's frame: its commands for this frame, or nothing when it has nothing new to draw. */
type Draw = () => { readonly queue: GPUQueue; readonly commands: GPUCommandBuffer } | undefined;

/** Every shader on screen, drawn in one animation frame and handed to the GPU in one submit. */
const drawing = new Set<Draw>();
let ticking = 0;

const tick = () => {
  ticking = drawing.size > 0 ? requestAnimationFrame(tick) : 0;
  const queues = new Map<GPUQueue, GPUCommandBuffer[]>();

  for (const draw of drawing) {
    const drawn = draw();

    if (drawn) queues.set(drawn.queue, [...(queues.get(drawn.queue) ?? []), drawn.commands]);
  }

  queues.forEach((commands, queue) => queue.submit(commands));
};

const draws = (draw: Draw, on: boolean) => {
  if (on) drawing.add(draw);
  else drawing.delete(draw);

  if (on && ticking === 0) ticking = requestAnimationFrame(tick);
};

const isRgb = (value: unknown): value is Rgb =>
  Array.isArray(value) && value.length === 3 && value.every((n) => Number.isFinite(n));

/** How many f32s a field fills from its offset: a point is two, a color three. */
const FLOATS = { time: 1, resolution: 2, clock: 1, number: 1, vec: 2, point: 2, color: 3 };

const isKind = (kind: unknown): kind is keyof typeof FLOATS => isString(kind) && kind in FLOATS;

/** A field as the build writes it: a known kind with its values, at a 4-byte offset that fits in `size` bytes. */
const isField =
  (size: number) =>
  (field: unknown): field is ShaderField => {
    if (!isObject(field) || !("name" in field) || !("at" in field) || !("kind" in field))
      return false;

    const { name, at, kind } = field;

    if (!isString(name) || !isNumber(at) || !isKind(kind) || at < 0 || at % 4 !== 0) return false;

    if (at + FLOATS[kind] * 4 > size) return false;

    const value = "value" in field ? field.value : undefined;

    switch (kind) {
      case "time":
      case "resolution":
        return true;
      case "clock":
        return "clock" in field && isString(field.clock);
      case "number":
        return isNumber(value) && Number.isFinite(value);
      case "vec":
      case "point":
        return isPoint(value);
      case "color":
        return "light" in field && "dark" in field && isRgb(field.light) && isRgb(field.dark);
    }
  };

/** The uniform layout a `<Shader>` group carries in `data-shader-inputs`, checked before a frame reads it. */
const isTable = (table: unknown): table is Table =>
  isObject(table) &&
  "size" in table &&
  "fields" in table &&
  isNumber(table.size) &&
  table.size > 0 &&
  table.size % 4 === 0 &&
  Array.isArray(table.fields) &&
  table.fields.every(isField(table.size));

/** The WGSL and uniform layout of a `<Shader>` group, or nothing when either is missing or malformed. */
const parsed = (group: Element): { readonly table: Table; readonly code: string } | undefined => {
  const code = group.querySelector(':scope > script[type="text/wgsl"]')?.textContent;

  try {
    const table: unknown = JSON.parse(group.getAttribute("data-shader-inputs") ?? "");

    return code && isTable(table) ? { table, code } : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Draws the WebGPU shader of one `<Shader>` group in its slot: a canvas the size of the box, redrawn every frame while it
 * is on screen, with the page's other shaders. Any failure, or a page without WebGPU, leaves the fallback as the picture.
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
  let draw: Draw | undefined;
  let watcher: IntersectionObserver | undefined;
  let configured: GPUCanvasContext | undefined;
  let uniform: GPUBuffer | undefined;

  const stop = () => {
    if (gone) return;
    gone = true;

    if (draw) draws(draw, false);
    watcher?.disconnect();
    release?.();
    configured?.unconfigure();
    uniform?.destroy();
    lent.back();
  };

  const lent = borrow(stop);

  const start = async () => {
    const made = await lent.device;

    if (!made || gone) return stop();

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgpu");

    if (!context) return stop();
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device: made, format, alphaMode: "premultiplied" });
    configured = context;
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

    uniform = buffer;

    const bindings = made.createBindGroup({
      layout: pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer } }],
    });

    if ((await made.popErrorScope()) || gone) return stop();

    Object.assign(canvas, { ariaHidden: "true" });
    Object.assign(canvas.style, CANVAS);
    const slot = slotOf(group, name);

    release = slot.host(canvas);

    const clockProgress = (clock: string): number => {
      const found = scene.clocks.get(clock);

      return found ? found.time / found.over : 0;
    };

    const begun = performance.now();
    let last = "";

    const valueOf = (field: ShaderField, w: number, h: number): readonly number[] => {
      switch (field.kind) {
        case "time":
          return [calm.matches ? 0 : (performance.now() - begun) / 1000];
        case "resolution":
          return [w, h];
        case "clock":
          return [clockProgress(field.clock)];
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

    const frame: Draw = () => {
      const { width, height } = canvas.getBoundingClientRect();
      const limit = made.limits.maxTextureDimension2D;

      const density = Math.min(
        devicePixelRatio,
        Math.sqrt(BUDGET / Math.max(1, width * height)),
        limit / Math.max(1, width, height),
      );

      const w = Math.max(1, Math.floor(width * density));
      const h = Math.max(1, Math.floor(height * density));

      if (canvas.width !== w || canvas.height !== h) Object.assign(canvas, { width: w, height: h });

      for (const field of table.fields) data.set(valueOf(field, w, h), field.at / 4);

      const now = data.join();

      if (calm.matches && now === last) return undefined;
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

      return { queue: made.queue, commands: encoder.finish() };
    };

    draw = frame;

    watcher = new IntersectionObserver((entries) => {
      if (!gone) draws(frame, entries.at(-1)?.isIntersecting ?? true);
    });

    watcher.observe(canvas);
    draws(frame, true);
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
