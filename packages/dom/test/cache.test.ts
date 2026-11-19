import { afterAll, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cached } from "../src/index.ts";
import { cachePath } from "../src/cache.ts";
import { runFilm } from "../src/vite.ts";

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

describe("cachePath", () => {
  test("true puts the file next to the film file", () => {
    expect(cachePath(true, "/a/b/card.film.tsx")).toBe("/a/b/card.film.states.json");
  });

  test("a relative path is relative to the film file, an absolute one is kept", () => {
    expect(cachePath("x/states.json", "/a/b/card.film.tsx")).toBe("/a/b/x/states.json");
    expect(cachePath("/tmp/s.json", undefined)).toBe("/tmp/s.json");
  });

  test("without a film file a relative path is an error", () => {
    expect(() => cachePath("s.json", undefined)).toThrow(/absolute path/);
  });
});

describe("film cache location", () => {
  const out = join(import.meta.dir, "app", "cache-out");
  const next = join(import.meta.dir, "app", "cached.film.states.json");

  afterAll(() => {
    rmSync(out, { recursive: true, force: true });
    rmSync(next, { force: true });
  });

  test("a relative cache lands next to the film file, whatever the cwd, under Bun and runFilm", async () => {
    rmSync(out, { recursive: true, force: true });
    const cwd = process.cwd();

    process.chdir(tmpdir());

    try {
      await import("./app/cached.film.ts");
      expect(existsSync(join(out, "states.json"))).toBe(true);

      rmSync(out, { recursive: true, force: true });
      await runFilm(join(import.meta.dir, "app", "cached.film.ts"));
      expect(existsSync(join(out, "states.json"))).toBe(true);
    } finally {
      process.chdir(cwd);
    }
  }, 120_000);

  test("cache: true is <film file>.states.json", async () => {
    process.env.CACHE_OPTION = "true";

    try {
      await runFilm(join(import.meta.dir, "app", "cached.film.ts"));
      expect(existsSync(next)).toBe(true);
    } finally {
      delete process.env.CACHE_OPTION;
    }
  }, 120_000);
});
