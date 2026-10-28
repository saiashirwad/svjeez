import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { copyFileSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { google } from "../src/index.ts";

const fixture = new URL("../../svjeez/tests/fixtures/ABeeZee-Regular.ttf", import.meta.url);

const realFetch = globalThis.fetch;
let cache: string;

const stubFetch = (stub: () => Promise<Response>) => {
  globalThis.fetch = stub as unknown as typeof fetch;
};

beforeEach(() => {
  cache = mkdtempSync(join(tmpdir(), "svjeez-fonts-"));
  process.env.SVJEEZ_FONTS_CACHE = cache;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  delete process.env.SVJEEZ_FONTS_CACHE;
  rmSync(cache, { recursive: true, force: true });
});

describe("google", () => {
  test("a cached font loads with no network", async () => {
    copyFileSync(fixture, join(cache, "ABeeZee-400-normal.ttf"));
    stubFetch(() => {
      throw new Error("network used");
    });

    const abeezee = await google("ABeeZee", { fallback: ["serif"] });

    expect(abeezee.family).toBe("ABeeZee");
    expect(abeezee.weight).toBe(400);
    expect(abeezee.fallback).toEqual(["serif"]);
    expect(abeezee.measure("Hello", 20)).toBeGreaterThan(0);
  });

  test("an unknown family names itself and carries Google's message", async () => {
    await expect(google("Nopeface Not A Font")).rejects.toThrow(
      /"Nopeface Not A Font" at weight 400.*400.*Font family not found/,
    );
    expect(readdirSync(cache)).toEqual([]);
  });

  test("a failed network on a cold cache names the family and the cache path", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    await expect(google("ABeeZee")).rejects.toThrow(
      new RegExp(`"ABeeZee".*${join(cache, "ABeeZee-400-normal.ttf").replace(/\./g, "\\.")}`),
    );
  });

  test("a real load measures text, caches the file, and groups into a family", async () => {
    const family = await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);

    expect(family.face(400).measure("Hello", 20)).toBeGreaterThan(0);
    expect(readdirSync(cache).sort()).toEqual(["ABeeZee-400-italic.ttf", "ABeeZee-400-normal.ttf"]);
  });
});
