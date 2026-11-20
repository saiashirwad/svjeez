import { expect, test } from "bun:test";
import { Shape, rect } from "svjeez";
import { svg } from "svjeez/tools";
import { OG_SIZE, ogScene } from "../src/index.ts";

const card = (options: Partial<Parameters<typeof ogScene>[0]> = {}) =>
  ogScene({ title: "Card", ...options }, () =>
    Shape({ geometry: rect(...OG_SIZE), fill: "#000000" }),
  );

test("an og scene is a link preview's size", () => {
  expect(svg.emit(card())).toContain('viewBox="0 0 1200 630"');
});

test("an og scene holds frame 0 and runs 4 seconds unless told otherwise", () => {
  expect([card().duration, card().still]).toEqual([4, 0]);
  expect([card({ duration: 6, still: 2 }).duration, card({ duration: 6, still: 2 }).still]).toEqual(
    [6, 2],
  );
});

test("renderOg draws a card as a JPEG, and ogResponse serves it", async () => {
  const { renderOg, ogResponse } = await import("../src/render.ts");
  const { bytes, type, width, height } = await renderOg(card());

  expect([type, width, height]).toEqual(["image/jpeg", 1200, 630]);
  expect(Array.from(bytes.subarray(0, 3))).toEqual([0xff, 0xd8, 0xff]);

  const response = await ogResponse(card());

  expect(response.headers.get("Content-Type")).toBe("image/jpeg");
  expect((await response.arrayBuffer()).byteLength).toBe(bytes.length);
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

test("renderStill takes the picture at `time` when given, as seconds or from the duration", async () => {
  const { renderStill } = await import("../src/render.ts");
  const [a, b] = await Promise.all([
    renderStill(card(), { time: 1 }),
    renderStill(card(), { time: (d) => d / 4 }),
  ]);

  expect(Array.from(a.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
  expect(Array.from(b.subarray(1, 4))).toEqual([0x50, 0x4e, 0x47]);
});
