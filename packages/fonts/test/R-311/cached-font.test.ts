import { describe, expect, test } from "bun:test";
import { copyFileSync } from "node:fs";
import { join } from "node:path";
import { google } from "../../src/index.ts";
import { fixture, stubFetch, useFontCache } from "../helpers/fonts-cache.ts";

const cache = useFontCache();

describe("google", () => {
  test("a cached font loads with no network", async () => {
    copyFileSync(fixture, join(cache.dir, "ABeeZee-400-normal.ttf"));
    stubFetch(() => {
      throw new Error("network used");
    });

    const abeezee = await google("ABeeZee", { fallback: ["serif"] });

    expect(abeezee.family).toBe("ABeeZee");
    expect(abeezee.weight).toBe(400);
    expect(abeezee.fallback).toEqual(["serif"]);
    expect(abeezee.measure("Hello", 20)).toBeGreaterThan(0);
  });
});
