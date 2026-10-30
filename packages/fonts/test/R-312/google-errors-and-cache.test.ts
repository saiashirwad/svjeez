import { describe, expect, test } from "bun:test";
import { readdirSync } from "node:fs";
import { google } from "../../src/index.ts";
import { stubFetch, useFontCache } from "../helpers/fonts-cache.ts";

const cache = useFontCache();

describe("google", () => {
  test("an unknown family names itself and carries Google's message", async () => {
    await expect(google("Nopeface Not A Font")).rejects.toThrow(
      /"Nopeface Not A Font" at weight 400.*400.*Font family not found/,
    );
    expect(readdirSync(cache.dir)).toEqual([]);
  });

  test("a failed network on a cold cache names the family", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    await expect(google("ABeeZee")).rejects.toThrow(/"ABeeZee"/);
  });

  test("a real load caches the file", async () => {
    await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);

    expect(readdirSync(cache.dir).sort()).toEqual([
      "ABeeZee-400-italic.ttf",
      "ABeeZee-400-normal.ttf",
    ]);
  });
});
