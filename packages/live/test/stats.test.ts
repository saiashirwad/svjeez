import { expect, test } from "bun:test";
import { sizeOf, statsOf } from "../src/stats";

test("sizes are bytes under a kilobyte, then kilobytes with a decimal until ten", () => {
  expect([0, 1023, 1024, 9999, 10240, 64512].map(sizeOf)).toEqual([
    "0 B",
    "1023 B",
    "1.0 KB",
    "9.8 KB",
    "10 KB",
    "63 KB",
  ]);
});

test("the build time joins the readout once a compile has measured it", () => {
  const stats = { gzip: 38000, keyframes: 1, scriptBytes: 0 };

  expect(statsOf({ ...stats, ms: null }).map((s) => `${s.value} ${s.label}`)).toEqual([
    "37 KB gzip",
    "1 keyframe",
    "0 B JS",
  ]);

  expect(statsOf({ ...stats, ms: 3.14 }).at(-1)).toEqual({ value: "3.1 ms", label: "to build" });
});
