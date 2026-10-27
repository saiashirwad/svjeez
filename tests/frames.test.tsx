import { describe, expect, test } from "bun:test";
import { def, ease, motion, render } from "svg-motion";
import { renderFrames } from "../src/frames";

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

  test("the contact sheet lays frames out in columns", async () => {
    const { sheet } = await renderFrames(fade, { times: [0, 1, 2, 3, 4, 5], sheet: { columns: 3 } });
    const { width, height } = pngSize(sheet!);
    expect(width).toBeGreaterThan(3 * 40);
    expect(width).toBeLessThan(4 * 40 + 60);
    expect(height).toBeGreaterThan(2 * 20);
  });

  test("an SVG without a numeric size is rejected", async () => {
    expect(renderFrames('<svg xmlns="http://www.w3.org/2000/svg"/>', { times: [0] })).rejects.toThrow("numeric width and height");
  });
});
