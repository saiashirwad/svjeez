import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import { Picture, def, ease, motion, picture, render, type SvgNode } from "svjeez";
import { renderFrames, systemColorScheme } from "svjeez/frames";

const browser = await renderFrames(render({ width: 4, height: 4, duration: 1, title: "Probe" }, <rect width={4} height={4} />), { times: [0] }).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);
    return false;
  },
);

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const solidPng = (width: number, height: number, [r, g, b]: [number, number, number]): Uint8Array => {
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;
    for (const byte of bytes) {
      c ^= byte;
      for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8);
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat())]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]);
};

const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

const fade = render(
  { width: 40, height: 20, duration: 4, title: "Fade" },
  <rect width={40} height={20} fill="#3EE6D6" animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1, ease.linear)} />,
);

describe.if(browser)("renderFrames", () => {
  test("frames at different times differ, and holds between transitions render the same", async () => {
    const { frames } = await renderFrames(fade, { times: [0, 1.5, 2.5, 3.5] });
    const [before, middle, after, later] = frames.map((frame) => frame.png) as [Uint8Array, Uint8Array, Uint8Array, Uint8Array];
    expect(same(before, middle)).toBe(false);
    expect(same(middle, after)).toBe(false);
    expect(same(after, later)).toBe(true);
  });

  test("the same time renders the same pixels every run", async () => {
    const [first, second] = await Promise.all([renderFrames(fade, { times: [1.5] }), renderFrames(fade, { times: [1.5] })]);
    expect(same(first.frames[0]!.png, second.frames[0]!.png)).toBe(true);
  });

  test("SMIL animations on filter primitives are seeked too", async () => {
    const flood = def.filter({}, <feFlood floodColor="#ff0000" animation={motion({ floodColor: "#ff0000" }).at(1).set({ floodColor: "#0000ff" })} />);
    const svg = render({ width: 20, height: 20, duration: 2, title: "Flood" }, <rect width={20} height={20} filter={flood} />);
    expect(svg).toContain("<animate");
    const { frames } = await renderFrames(svg, { times: [0.5, 1.5, 1.8] });
    expect(same(frames[0]!.png, frames[1]!.png)).toBe(false);
    expect(same(frames[1]!.png, frames[2]!.png)).toBe(true);
  });

  test("count spreads frames over one loop, at the requested scale", async () => {
    const { duration, frames } = await renderFrames(fade, { count: 4, scale: 2 });
    expect(duration).toBe(4);
    expect(frames.map((frame) => frame.time)).toEqual([0, 1, 2, 3]);
    expect(pngSize(frames[0]!.png)).toEqual({ width: 80, height: 40 });
  });

  test("a scene made only of loops lasts as long as their common period", async () => {
    const svg = render(
      { width: 20, height: 20, duration: 6, title: "Loops" },
      <>
        <rect width={10} height={10} animation={motion({ x: 0 }).to({ x: 10 }, 2, ease.linear).loop(2)} />
        <circle r={4} animation={motion({ y: 0 }).to({ y: 10 }, 3, ease.linear).loop(3)} />
      </>,
    );
    expect((await renderFrames(svg, { times: [0] })).duration).toBe(6);
  });

  test("a sheet too big for one capture comes back whole, at a lower scale", async () => {
    const wide = render({ width: 2000, height: 100, duration: 4, title: "Wide" }, <rect width={2000} height={100} fill="#3EE6D6" />);
    const { sheet } = await renderFrames(wide, { count: 4, scale: 3, sheet: true });
    const { width, height } = pngSize(sheet!);
    const css = { width: 4 * (2000 + 12) + 12, height: 100 + 12 + 20 + 12 };
    expect(width).toBeLessThanOrEqual(16384);
    expect(width).toBeGreaterThan(css.width);
    expect(height / width).toBeCloseTo(css.height / css.width, 2);
  });

  test("the contact sheet lays frames out in columns", async () => {
    const { sheet } = await renderFrames(fade, { times: [0, 1, 2, 3, 4, 5], sheet: { columns: 3 } });
    const { width, height } = pngSize(sheet!);
    expect(width).toBeGreaterThan(3 * 40);
    expect(width).toBeLessThan(4 * 40 + 60);
    expect(height).toBeGreaterThan(2 * 20);
  });

  test("a non-positive scale or column count is rejected", async () => {
    expect(renderFrames(fade, { times: [0], scale: 0 })).rejects.toThrow("scale");
    expect(renderFrames(fade, { times: [0], sheet: { columns: 1.5 } })).rejects.toThrow("columns");
  });

  test("frames follow the system color scheme unless told otherwise", async () => {
    const svg = render(
      { width: 20, height: 20, duration: 1, title: "Scheme", css: "rect{fill:#ffffff}@media (prefers-color-scheme:dark){rect{fill:#000000}}" },
      <rect width={20} height={20} />,
    );
    const [light, dark, system, fallback] = await Promise.all([
      renderFrames(svg, { times: [0], colorScheme: "light" }),
      renderFrames(svg, { times: [0], colorScheme: "dark" }),
      renderFrames(svg, { times: [0], colorScheme: "system" }),
      renderFrames(svg, { times: [0] }),
    ]);
    expect(same(light.frames[0]!.png, dark.frames[0]!.png)).toBe(false);
    expect(fallback.colorScheme).toBe(systemColorScheme());
    expect(system.colorScheme).toBe(systemColorScheme());
    expect(same(fallback.frames[0]!.png, (systemColorScheme() === "dark" ? dark : light).frames[0]!.png)).toBe(true);
  });

  test("an SVG without a numeric size is rejected", async () => {
    expect(renderFrames('<svg xmlns="http://www.w3.org/2000/svg"/>', { times: [0] })).rejects.toThrow("numeric width and height");
  });

  test("an embedded raster and an embedded SVG paint their own colors", async () => {
    const scene = (child: SvgNode) => render({ width: 20, height: 20, duration: 1, title: "Embed" }, child);
    const raster = picture(solidPng(8, 8, [0, 200, 0]));
    const vector = picture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#c80000"/></svg>');
    const paint = async (child: SvgNode) => (await renderFrames(scene(child), { times: [0], colorScheme: "light" })).frames[0]!.png;
    const png = await paint(<Picture src={raster} x={0} y={0} width={20} height={20} />);
    const svg = await paint(<Picture src={vector} x={0} y={0} width={20} height={20} />);
    const green = await paint(<rect width={20} height={20} fill="#00c800" />);
    const red = await paint(<rect width={20} height={20} fill="#c80000" />);
    expect(same(png, green)).toBe(true);
    expect(same(svg, red)).toBe(true);
    expect(same(png, svg)).toBe(false);
  });
});
