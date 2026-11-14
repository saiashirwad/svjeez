import { expect, test } from "bun:test";
import { assets, register } from "../src/assets.ts";

test("past assets.limit, the oldest files are dropped and a re-registered one is kept", () => {
  const asset = { type: "image/svg+xml", bytes: async () => new Uint8Array() };
  const before = assets.limit;
  assets.files.clear();
  assets.limit = 3;

  try {
    for (const name of ["a", "b", "c"]) register(name, asset);
    register("a", asset);
    register("d", asset);

    expect([...assets.files.keys()]).toEqual(["c", "a", "d"]);
  } finally {
    assets.limit = before;
    assets.files.clear();
  }
});

test("with no limit, a build keeps every file", () => {
  const asset = { type: "image/svg+xml", bytes: async () => new Uint8Array() };
  const before = assets.limit;
  assets.limit = undefined;
  assets.files.clear();

  for (let i = 0; i < 1000; i++) register(String(i), asset);

  expect(assets.files.size).toBe(1000);
  assets.limit = before;
  assets.files.clear();
});
