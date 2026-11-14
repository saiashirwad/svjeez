import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { google } from "@svjeez/fonts";
import { render } from "svjeez";
import { jsx } from "svjeez/jsx-runtime";

const cache = mkdtempSync(join(tmpdir(), "svjeez-fonts-consumer-"));

process.env.SVJEEZ_FONTS_CACHE = cache;

try {
  const geist = await google("Geist", { weight: 500, ligatures: false });
  const width = geist.measure("Hello", 24);

  assert.ok(width > 0);
  assert.deepEqual(readdirSync(cache), ["Geist-500-normal.ttf"]);

  const svg = render({ width: 200, height: 60, duration: 1, title: "Hello" }, [
    jsx("text", { x: 10, y: 40, fontFamily: geist, fontSize: 24, children: "Hello" }),
  ]);

  assert.match(svg, /@font-face/);
  console.log(`measured Hello at ${width.toFixed(1)}px and embedded ${geist.family}`);
} finally {
  rmSync(cache, { recursive: true, force: true });
}
