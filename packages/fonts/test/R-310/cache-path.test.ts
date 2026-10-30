import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { google } from "../../src/index.ts";
import { stubFetch, useFontCache } from "../helpers/fonts-cache.ts";

const cache = useFontCache();

describe("google", () => {
  test("a failed network on a cold cache names the family and the cache path", async () => {
    stubFetch(() => Promise.reject(new TypeError("fetch failed")));

    await expect(google("ABeeZee")).rejects.toThrow(
      new RegExp(`"ABeeZee".*${join(cache.dir, "ABeeZee-400-normal.ttf").replace(/\./g, "\\.")}`),
    );
  });
});
