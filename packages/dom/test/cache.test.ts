import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cached } from "../src/index.ts";

const dir = mkdtempSync(join(tmpdir(), "svjeez-cache-"));

afterAll(() => rmSync(dir, { recursive: true, force: true }));

let n = 0;
const file = () => join(dir, `${++n}`, "states.json");

beforeEach(() => {
  delete process.env.SVJEEZ_DOM_REFRESH;
});

describe("cached", () => {
  test("runs once for the same inputs, whatever the key order", async () => {
    const f = file();
    let runs = 0;
    const fn = () => ++runs;

    expect(await cached(f, { a: 1, b: 2 }, fn)).toBe(1);
    expect(await cached(f, { b: 2, a: 1 }, fn)).toBe(1);
    expect(runs).toBe(1);
  });

  test("runs again when the inputs change", async () => {
    const f = file();
    let runs = 0;

    await cached(f, "a", () => ++runs);

    expect(await cached(f, "b", () => ++runs)).toBe(2);
  });

  test("SVJEEZ_DOM_REFRESH=1 forces a re-run", async () => {
    const f = file();
    let runs = 0;

    await cached(f, "a", () => ++runs);
    process.env.SVJEEZ_DOM_REFRESH = "1";

    expect(await cached(f, "a", () => ++runs)).toBe(2);
  });

  test("runs again when the Snapshot version differs or the file is damaged", async () => {
    const f = file();
    let runs = 0;

    await cached(f, "a", () => ++runs);

    const stored = JSON.parse(readFileSync(f, "utf8"));

    writeFileSync(f, JSON.stringify({ ...stored, version: 0 }));

    expect(await cached(f, "a", () => ++runs)).toBe(2);

    writeFileSync(f, "{nope");

    expect(await cached(f, "a", () => ++runs)).toBe(3);
  });
});
