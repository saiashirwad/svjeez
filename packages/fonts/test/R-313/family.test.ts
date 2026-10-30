import { describe, expect, test } from "bun:test";
import { google } from "../../src/index.ts";
import { useFontCache } from "../helpers/fonts-cache.ts";

useFontCache();

describe("google", () => {
  test("a real load measures text and groups into a family", async () => {
    const family = await google.family("ABeeZee", [400, { weight: 400, style: "italic" }]);

    expect(family.face(400).measure("Hello", 20)).toBeGreaterThan(0);
  });
});
