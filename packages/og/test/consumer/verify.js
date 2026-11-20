import { strict as assert } from "node:assert";
import { OG_SIZE, ogScene } from "@svjeez/og";
import { ogResponse, renderOg } from "@svjeez/og/render";
import { Shape, rect } from "svjeez";

const card = ogScene({ title: "Card" }, () =>
  Shape({ geometry: rect(...OG_SIZE), fill: "#336699" }),
);

const { bytes, type, width, height } = await renderOg(card);

assert.deepEqual([type, width, height], ["image/jpeg", 1200, 630]);

assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);

assert.equal(
  (await ogResponse(card, { format: "webp" })).headers.get("Content-Type"),
  "image/webp",
);

console.log("rendered a card to a JPEG and a WebP");
