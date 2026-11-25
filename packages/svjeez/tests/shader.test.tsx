import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium, type Browser, type Page } from "playwright-core";
import {
  Sequence,
  Shader,
  Shape,
  clock,
  enter,
  rect,
  scene,
  span,
  type SceneElement,
} from "svjeez";
import { loadTypeGpu, svg } from "svjeez/tools";

// A "use gpu" function is compiled as its module is imported, so the fragments live in a module imported after this.
await loadTypeGpu(import.meta.dir);

const { gradient, renamed, turning } = await import("./fixtures/shaders");

const storm = clock("storm", span(0, 1));

// A scene with a bar on the storm clock beside `sky`, the shader under test.
const withShader = (sky: SceneElement) =>
  svg.emit(
    scene({ size: [120, 80], duration: 2, title: "Shader" }, () => (
      <>
        <Sequence clock={storm}>
          <Shape key="bar" geometry={rect(10, 10)} fill="#000000" motion={enter(span(0, 1))} />
        </Sequence>
        {sky}
      </>
    )),
  );

const FALLBACK = <Shape geometry={rect(20, 20)} fill="#00ff00" />;

const build = (fragment: typeof gradient | typeof turning, wrong?: string) => {
  const markup = withShader(
    <Shader name="sky" width={80} height={60} at={[20, 10]} inputs={{ storm }} fragment={fragment}>
      {FALLBACK}
    </Shader>,
  );

  return wrong === undefined ? markup : markup.replace("svjeez_vertex", wrong);
};

// Headless Chromium has WebGPU where the machine has a GPU or a software Vulkan: Metal on a Mac, SwiftShader elsewhere.
const FLAGS =
  process.platform === "darwin"
    ? ["--enable-unsafe-webgpu", "--use-angle=metal", "--ignore-gpu-blocklist"]
    : [
        "--enable-unsafe-webgpu",
        "--enable-features=Vulkan",
        "--use-angle=swiftshader",
        "--use-webgpu-adapter=swiftshader",
        "--ignore-gpu-blocklist",
      ];

const dir = mkdtempSync(join(tmpdir(), "svjeez-shader-"));
const entry = join(dir, "entry.ts");

writeFileSync(
  entry,
  `import * as lib from ${JSON.stringify(join(import.meta.dir, "../src/page.ts"))};\n(globalThis as any).lib = lib;\n`,
);

const built = await Bun.build({ entrypoints: [entry], target: "browser", format: "iife" });
const library = await built.outputs[0]!.text();
const browser: Browser = await chromium.launch({ args: FLAGS });

// WebGPU needs a secure context, which localhost is: pages are served from it, by the browser's own routing.
const ORIGIN = "http://localhost/";

const served = async (page: Page, markup: string) => {
  await page.route(ORIGIN, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><body style="margin:0">${markup}</body>`,
    }),
  );
  await page.goto(ORIGIN);
};

const probe = await browser.newPage();

await served(probe, "");

// An adapter is not enough: software WebGPU on a headless Linux machine can have one and still lose its device the first
// time it presents to a canvas. The probe draws one frame to a canvas and sees whether the device survives.
const webgpu = await probe.evaluate(async () => {
  try {
    const adapter = await navigator.gpu?.requestAdapter();

    if (!adapter) return false;
    const device = await adapter.requestDevice();
    let lost = false;

    void device.lost.then(() => (lost = true));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgpu");

    if (!context) return false;
    const format = navigator.gpu.getPreferredCanvasFormat();

    context.configure({ device, format, alphaMode: "premultiplied" });
    const encoder = device.createCommandEncoder();

    encoder
      .beginRenderPass({
        colorAttachments: [
          {
            view: context.getCurrentTexture().createView(),
            clearValue: [0, 0, 0, 0],
            loadOp: "clear",
            storeOp: "store",
          },
        ],
      })
      .end();

    device.queue.submit([encoder.finish()]);
    await new Promise((resolve) => setTimeout(resolve, 500));
    device.destroy();

    return !lost;
  } catch {
    return false;
  }
});

afterAll(() => browser.close());

// WebGPU is not on every CI machine: these tests are skipped where the browser cannot draw to a canvas with it.
const gpu = webgpu ? test : test.skip;

interface Opened {
  readonly page: Page;
  /** What the page logged as a warning or an error. */
  readonly noise: string[];
}

const open = async (
  markup: string,
  {
    reducedMotion = "no-preference",
    below = 0,
  }: { reducedMotion?: "reduce" | "no-preference"; below?: number } = {},
): Promise<Opened> => {
  const page = await browser.newPage({
    reducedMotion,
    deviceScaleFactor: 2,
    viewport: { width: 300, height: 200 },
  });

  const noise: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") noise.push(message.text());
  });
  page.on("pageerror", (error) => noise.push(error.message));
  await served(page, `<div style="height:${below}px"></div>${markup}`);
  await page.addScriptTag({ content: library });

  // What the page's WebGPU was asked for: the devices it made and the frames it submitted.
  await page.evaluate(() => {
    const devices: { destroyed: boolean }[] = [];
    const seen = { devices, submits: 0 };

    Object.assign(globalThis, { seen });

    if (!navigator.gpu) return;
    const request = GPUAdapter.prototype.requestDevice;

    GPUAdapter.prototype.requestDevice = async function (...args) {
      const device = await request.apply(this, args);
      const record = { destroyed: false };
      const destroy = device.destroy.bind(device);

      device.destroy = () => {
        record.destroyed = true;
        destroy();
      };

      seen.devices.push(record);

      return device;
    };

    const submit = GPUQueue.prototype.submit;

    GPUQueue.prototype.submit = function (...args) {
      seen.submits++;

      return submit.apply(this, args);
    };
  });

  return { page, noise };
};

const run = <T,>(page: Page, code: string) => page.evaluate<T>(`(async () => { ${code} })()`);

const MOUNT = "globalThis.scene = lib.mount(document.querySelector('svg'));";

const settle = (page: Page) => page.waitForTimeout(400);

/** How many different colors a PNG holds, and its mean blue. */
const colors = (png: Buffer) =>
  probe.evaluate(async (data) => {
    const image = new Image();

    image.src = `data:image/png;base64,${data}`;
    await image.decode();
    const canvas = document.createElement("canvas");

    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext("2d")!;

    context.drawImage(image, 0, 0);
    const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height);
    const distinct = new Set<number>();
    let blue = 0;

    for (let at = 0; at < pixels.length; at += 4) {
      distinct.add((pixels[at]! << 16) | (pixels[at + 1]! << 8) | pixels[at + 2]!);
      blue += pixels[at + 2]!;
    }

    return { distinct: distinct.size, blue: blue / (pixels.length / 4) };
  }, png.toString("base64"));

const shot = (page: Page) => page.locator("foreignObject canvas").screenshot();

/** Two shaders side by side, or one of `width` by `height` alone. */
const many = (count: number, width = 80, height = 60) =>
  svg.emit(
    scene({ size: [count * width, height], duration: 2, title: "Shaders" }, () => (
      <>
        {Array.from({ length: count }, (_, index) => (
          <Shader
            key={String(index)}
            name={`sky${index}`}
            width={width}
            height={height}
            at={[index * width, 0]}
            fragment={turning}
          >
            <Shape geometry={rect(20, 20)} fill="#00ff00" />
          </Shader>
        ))}
      </>
    )),
  );

describe("the shader runner", () => {
  gpu("hosts a canvas over the slot's box, in device pixels, and hides the fallback", async () => {
    const { page, noise } = await open(build(gradient));

    await run(page, MOUNT);
    await settle(page);

    const look = await run<{
      canvas: number[];
      frame: number[];
      pixels: number[];
      fallback: string;
      aria: string | null;
    }>(
      page,
      `const canvas = document.querySelector('foreignObject canvas');
       const frame = document.querySelector('foreignObject').getBoundingClientRect();
       const box = canvas.getBoundingClientRect();
       return {
         canvas: [box.x, box.y, box.width, box.height],
         frame: [frame.x, frame.y, frame.width, frame.height],
         pixels: [canvas.width, canvas.height],
         fallback: getComputedStyle(document.querySelector('[data-slot] > rect')).opacity,
         aria: canvas.getAttribute('aria-hidden'),
       };`,
    );

    expect(look.canvas).toEqual(look.frame);
    expect(look.canvas.slice(2)).toEqual([80, 60]);
    expect(look.pixels).toEqual([160, 120]);
    expect(look.fallback).toBe("0");
    expect(look.aria).toBe("true");
    expect(noise).toEqual([]);
    await page.close();
  });

  gpu("draws more than one color, and a moved clock input changes the picture", async () => {
    const { page, noise } = await open(build(gradient));

    await run(page, MOUNT);
    await run(page, "scene.clock('storm').progress(0);");
    await settle(page);
    const calm = await shot(page);

    await run(page, "scene.clock('storm').progress(1);");
    await settle(page);
    const stormy = await shot(page);

    const [before, after] = [await colors(calm), await colors(stormy)];

    expect(before.distinct).toBeGreaterThan(100);
    expect(after.distinct).toBeGreaterThan(100);
    // The gradient's blue is the clock's progress.
    expect(before.blue).toBeLessThan(20);
    expect(after.blue).toBeGreaterThan(before.blue + 100);
    expect(calm.equals(stormy)).toBe(false);
    expect(noise).toEqual([]);
    await page.close();
  });

  gpu("an input named apart from its clock follows that clock", async () => {
    const { page, noise } = await open(
      withShader(
        <Shader
          name="sky"
          width={80}
          height={60}
          at={[20, 10]}
          inputs={{ weather: storm }}
          fragment={renamed}
        >
          {FALLBACK}
        </Shader>,
      ),
    );

    await run(page, MOUNT);
    await run(page, "scene.clock('storm').progress(0);");
    await settle(page);
    const before = await colors(await shot(page));

    await run(page, "scene.clock('storm').progress(1);");
    await settle(page);
    const after = await colors(await shot(page));

    expect(after.blue).toBeGreaterThan(before.blue + 100);
    expect(noise).toEqual([]);
    await page.close();
  });

  gpu("its time runs, and under reduced motion it stands still", async () => {
    const moving = await open(build(turning));

    await run(moving.page, MOUNT);
    await settle(moving.page);
    const first = await shot(moving.page);

    await moving.page.waitForTimeout(700);
    expect((await shot(moving.page)).equals(first)).toBe(false);
    await moving.page.close();

    const calm = await open(build(turning), { reducedMotion: "reduce" });

    await run(calm.page, MOUNT);
    await settle(calm.page);
    const still = await shot(calm.page);

    await calm.page.waitForTimeout(700);
    expect((await shot(calm.page)).equals(still)).toBe(true);
    expect((await colors(still)).distinct).toBeGreaterThan(100);
    await calm.page.close();
  });

  gpu("does not draw while it is off screen, and draws when it is scrolled to", async () => {
    const { page } = await open(build(turning), { below: 2000 });

    await run(page, MOUNT);
    await page.waitForTimeout(300);
    const hidden = await run<number>(page, "return seen.submits;");

    // The frame or two before the browser says it is off screen are drawn; then it stops.
    await page.waitForTimeout(400);
    expect(await run<number>(page, "return seen.submits;")).toBe(hidden);

    await page.evaluate(() => scrollTo(0, 2000));
    await page.waitForTimeout(500);

    expect(await run<number>(page, "return seen.submits;")).toBeGreaterThan(hidden + 5);
    await page.close();
  });

  gpu("unmount stops the frame loop, frees the device and gives the fallback back", async () => {
    const { page } = await open(build(turning));

    await run(page, MOUNT);
    await settle(page);
    expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(1);

    await run(page, "scene.unmount();");
    const stopped = await run<number>(page, "return seen.submits;");

    await page.waitForTimeout(300);

    expect(await run<number>(page, "return seen.submits;")).toBe(stopped);
    expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(0);
    expect(await run<boolean[]>(page, "return seen.devices.map((one) => one.destroyed);")).toEqual([
      true,
    ]);
    expect(
      await run<string>(
        page,
        "return getComputedStyle(document.querySelector('[data-slot] > rect')).opacity;",
      ),
    ).toBe("1");
    await page.close();
  });

  gpu("mounting twice, as React's StrictMode does, leaves one canvas and one device", async () => {
    const { page, noise } = await open(build(turning));

    await run(page, MOUNT);
    await run(page, "scene.unmount();");
    await run(page, MOUNT);
    await settle(page);

    expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(1);

    const devices = await run<boolean[]>(page, "return seen.devices.map((one) => one.destroyed);");

    expect(devices.filter((destroyed) => !destroyed)).toHaveLength(1);
    expect(noise).toEqual([]);
    await page.close();
  });

  gpu(
    "shaders on one page share one device, and hand the GPU each frame in one submit",
    async () => {
      const { page, noise } = await open(many(2));

      await run(page, MOUNT);
      await settle(page);

      const counted = await run<{ frames: number; submits: number }>(
        page,
        `const from = seen.submits;
       let frames = 0;
       await new Promise((done) => {
         const count = () => (++frames < 30 ? requestAnimationFrame(count) : done());
         requestAnimationFrame(count);
       });
       return { frames, submits: seen.submits - from };`,
      );

      expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(2);
      expect(await run<number>(page, "return seen.devices.length;")).toBe(1);
      expect(counted.submits).toBeGreaterThan(counted.frames / 2);
      expect(counted.submits).toBeLessThanOrEqual(counted.frames + 1);

      await run(page, "scene.unmount();");
      expect(
        await run<boolean[]>(page, "return seen.devices.map((one) => one.destroyed);"),
      ).toEqual([true]);
      expect(noise).toEqual([]);
      await page.close();
    },
  );

  gpu(
    "a large box draws at a lower density, so its canvas stays within the pixel budget",
    async () => {
      const { page, noise } = await open(many(1, 1600, 1000));

      await run(page, MOUNT);
      await settle(page);

      const [width, height] = await run<[number, number]>(
        page,
        "const canvas = document.querySelector('foreignObject canvas'); return [canvas.width, canvas.height];",
      );

      // At the page's density of 2 it would be 3200 by 2000; it keeps the box's shape at 1.5 million pixels.
      expect(width * height).toBeLessThanOrEqual(1_500_000);
      expect(width * height).toBeGreaterThan(1_450_000);
      expect(Math.abs(width / height - 1.6)).toBeLessThan(0.01);
      expect(noise).toEqual([]);
      await page.close();
    },
  );

  gpu("a layout that is not the build's keeps the fallback, and says nothing", async () => {
    // A field past the end of the buffer, and one whose kind no build writes.
    const broken = [
      '{"size":16,"fields":[{"name":"storm","kind":"clock","clock":"storm","at":64}]}',
      '{"size":16,"fields":[{"name":"storm","kind":"noise","at":0}]}',
      "not json",
    ];

    for (const inputs of broken) {
      const markup = build(gradient).replace(
        /data-shader-inputs='[^']*'|data-shader-inputs="[^"]*"/,
        `data-shader-inputs='${inputs}'`,
      );

      const { page, noise } = await open(markup);

      await run(page, MOUNT);
      await settle(page);

      expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(0);
      expect(noise).toEqual([]);
      await page.close();
    }
  });

  gpu("a shader that does not compile keeps the fallback, and says nothing", async () => {
    const { page, noise } = await open(build(gradient, "nope"));

    await run(page, MOUNT);
    await settle(page);

    expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(0);
    expect(
      await run<string>(
        page,
        "return getComputedStyle(document.querySelector('[data-slot] > rect')).opacity;",
      ),
    ).toBe("1");
    expect(await run<boolean[]>(page, "return seen.devices.map((one) => one.destroyed);")).toEqual([
      true,
    ]);
    expect(noise).toEqual([]);
    await page.close();
  });

  test("a page without WebGPU keeps the fallback, and says nothing", async () => {
    const { page, noise } = await open(build(gradient));

    await page.evaluate(() => {
      Object.defineProperty(Navigator.prototype, "gpu", {
        get: () => undefined,
        configurable: true,
      });
    });
    await run(page, MOUNT);
    await settle(page);

    expect(await run<number>(page, "return document.querySelectorAll('canvas').length;")).toBe(0);
    expect(
      await run<string>(
        page,
        "return getComputedStyle(document.querySelector('[data-slot] > rect')).opacity;",
      ),
    ).toBe("1");
    expect(await run<number>(page, "return scene.clocks.size;")).toBe(1);
    expect(noise).toEqual([]);
    await page.close();
  });
});
