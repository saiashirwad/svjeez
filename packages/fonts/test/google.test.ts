import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { google } from "../src/index.ts";

const fixture = new URL("../../svjeez/tests/fixtures/ABeeZee-Regular.ttf", import.meta.url);

// The tests that reach Google need a network, and skip when there is none.
const online = await fetch("https://fonts.googleapis.com/", {
  method: "HEAD",
  signal: AbortSignal.timeout(3000),
}).then(
  () => true,
  () => false,
);

const realFetch = globalThis.fetch;
let cache: string;

const stubFetch = (stub: () => Promise<Response>) => {
  globalThis.fetch = Object.assign(stub, { preconnect: realFetch.preconnect });
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

  test.skipIf(!online)("an unknown family names itself and carries Google's message", async () => {
    await expect(google("Nopeface Not A Font")).rejects.toThrow(
      /"Nopeface Not A Font" at weight 400.*400.*Font family not found/,
    );
    expect(readdirSync(cache)).toEqual([]);
  });

  test("families that differ only in punctuation get their own cache files", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    for (const family of ["Open Sans", "Open-Sans", "Open_Sans"])
      await google(family).catch(() => {});

    // Each family's error names its own path
    const paths = new Set<string>();

    for (const family of ["Open Sans", "Open-Sans", "Open_Sans"])
      await google(family).catch((e: Error) => paths.add(/(\S+\.ttf)/.exec(e.message)![1]!));

    expect(paths.size).toBe(3);
  });

  test("a torn cached file is fetched again and replaced", async () => {
    const whole = readFileSync(fixture);
    writeFileSync(join(cache, "ABeeZee-400-normal.ttf"), whole.subarray(0, whole.length >> 1));
    stubFetch(async () => new Response(whole));
    globalThis.fetch = Object.assign(
      async (url: string | URL | Request) =>
        String(url).includes("googleapis")
          ? new Response("@font-face { src: url(https://fonts.gstatic.com/a.ttf) }")
          : new Response(whole),
      { preconnect: realFetch.preconnect },
    );

    const abeezee = await google("ABeeZee");

    expect(abeezee.measure("Hello", 20)).toBeGreaterThan(0);
    expect(readFileSync(join(cache, "ABeeZee-400-normal.ttf")).length).toBe(whole.length);
  });

  test("a failed network on a cold cache names the family and the cache path", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    await expect(google("ABeeZee")).rejects.toThrow(
      new RegExp(`"ABeeZee".*${join(cache, "ABeeZee-400-normal.ttf").replace(/\./g, "\\.")}`),
    );
  });

  test.skipIf(!online)(
    "a real load measures text, caches the file, and groups into a family",
    async () => {
      const family = await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);

      expect(family.face(400).measure("Hello", 20)).toBeGreaterThan(0);
      expect(readdirSync(cache).sort()).toEqual([
        "ABeeZee-400-italic.ttf",
        "ABeeZee-400-normal.ttf",
      ]);
    },
  );
});
