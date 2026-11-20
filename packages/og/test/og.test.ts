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
