/** @jsxImportSource svjeez */
import { expect, test } from "bun:test";
import { Shape, rect } from "svjeez";
import { svg } from "svjeez/tools";
import { OG_SIZE, ogScene } from "../src/index.ts";

const card = (options: Partial<Parameters<typeof ogScene>[0]> = {}) =>
  ogScene({ title: "Card", ...options }, () => (
    <Shape geometry={rect(...OG_SIZE)} fill="#000000" />
  ));

test("an og scene is a link preview's size, unless overridden", () => {
  expect(svg.emit(card())).toContain('viewBox="0 0 1200 630"');
  expect(svg.emit(card({ size: [1200, 1200] }))).toContain('viewBox="0 0 1200 1200"');
});

test("an og scene holds frame 0 and runs 4 seconds unless told otherwise", () => {
  expect([card().duration, card().still]).toEqual([4, 0]);
  expect([card({ duration: 6, still: 2 }).duration, card({ duration: 6, still: 2 }).still]).toEqual(
    [6, 2],
  );
});

test("renderOg draws a card as a JPEG, and ogResponse serves it with cache headers", async () => {
  const { renderOg, ogResponse } = await import("../src/render.ts");
  const { bytes, type, width, height } = await renderOg(card());

  expect([type, width, height]).toEqual(["image/jpeg", 1200, 630]);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);

  const response = await ogResponse(card());

  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  expect(response.headers.get("ETag")).toMatch(/^"[A-Za-z0-9_-]{12}\.jpg"$/);
  expect(response.headers.get("Cache-Control")).toContain("public");
  expect((await response.arrayBuffer()).byteLength).toBe(bytes.length);

  const custom = await ogResponse(card(), {
    headers: { "Cache-Control": "public, max-age=60" },
  });

  expect(custom.headers.get("Cache-Control")).toBe("public, max-age=60");
});

test("an image's name ignores options left at their defaults", async () => {
  const { imageName, imageType } = await import("../src/render.ts");
  const markup = svg.emit(card());

  expect(imageName(markup, { time: 0, scheme: "light", scale: 1 })).toBe(imageName(markup));
  expect(imageName(markup, { scale: 2 })).not.toBe(imageName(markup));
  expect(imageName(markup, { format: "png" })).toEndWith(".png");
  expect([imageType(), imageType({ format: "webp" })]).toEqual(["image/jpeg", "image/webp"]);
});

test("renderOg draws a card as a PNG and reports scaled dimensions", async () => {
  const { renderOg } = await import("../src/render.ts");
  const { bytes, type, width, height } = await renderOg(card(), { format: "png", scale: 2 });

  expect([type, width, height]).toEqual(["image/png", 2400, 1260]);
  expect(Array.from(bytes.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
});

test("renderOg accepts a custom rasterizer via option or settings.render", async () => {
  const { renderOg, settings } = await import("../src/render.ts");
  const fake = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  let received: { format: string; scale: number } | undefined;

  const one = await renderOg(card({ title: "Custom option" }), {
    format: "png",
    scale: 1.5,
    render: async (_svg, opts) => {
      received = { format: opts.format, scale: opts.scale };

      return fake;
    },
  });

  expect(one.bytes).toEqual(fake);
  expect([one.type, one.width, one.height]).toEqual(["image/png", 1800, 945]);
  expect(received).toEqual({ format: "png", scale: 1.5 });

  const previous = settings.render;
  settings.render = async () => fake;

  try {
    const two = await renderOg(card({ title: "Custom settings" }), { format: "webp" });
    expect(two.bytes).toEqual(fake);
    expect(two.type).toBe("image/webp");
  } finally {
    settings.render = previous;
  }
});

test("renderStill takes a scene's held moment as a transparent PNG at 2x", async () => {
  const { renderStill } = await import("../src/render.ts");
  const png = await renderStill(card());

  expect(Array.from(png.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  expect(new DataView(png.buffer, png.byteOffset).getUint32(16)).toBe(OG_SIZE[0] * 2);
});

test("stillTime is the held moment, else 72% in", async () => {
  const { stillTime } = await import("../src/render.ts");

  expect(stillTime("animation-delay:-1.5s!important", 4)).toBe(1.5);
  expect(stillTime("<svg/>", 10)).toBeCloseTo(7.2);
});

test("renderStill takes the picture at `time` when given", async () => {
  const { renderStill } = await import("../src/render.ts");
  const png = await renderStill(card(), { time: 1 });

  expect(Array.from(png.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
});
