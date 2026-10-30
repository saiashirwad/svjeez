import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { fixture, italic, monoBold, sans } from "../helpers/font";

describe("font", () => {
  test("reads family, weight, style and a fallback from the file", () => {
    expect(sans).toMatchObject({
      format: "ttf",
      family: "ABeeZee",
      weight: 400,
      style: "normal",
      fallback: ["sans-serif"],
    });
    expect(italic).toMatchObject({ family: "ABeeZee", style: "italic" });
    expect(monoBold).toMatchObject({ family: "Space Mono", weight: 700, fallback: ["monospace"] });
  });

  test("options override what the file says", async () => {
    const bytes = await readFile(fixture("ABeeZee-Regular"));
    expect(
      font(bytes, { family: "Body", weight: 500, style: "italic", fallback: ["Georgia", "serif"] }),
    ).toMatchObject({
      family: "Body",
      weight: 500,
      style: "italic",
      fallback: ["Georgia", "serif"],
    });
  });

  test("the bytes become a base64 data URI with the font's media type", async () => {
    const bytes = await readFile(fixture("ABeeZee-Regular"));
    expect(sans.href.startsWith("data:font/ttf;base64,")).toBe(true);
    expect(Buffer.from(sans.href.split(",")[1]!, "base64").equals(bytes)).toBe(true);
    expect(sans.bytes).toBe(sans.href.length);
  });

  test("rejects what it cannot read", () => {
    expect(() => font(new Uint8Array(4))).toThrow("empty or truncated");
    expect(() =>
      font(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0])),
    ).toThrow("Unknown font format");
    expect(() => font(Uint8Array.from([...Buffer.from("ttcf"), 0, 1, 0, 0, 0, 0, 0, 1]))).toThrow(
      "font collection",
    );
  });

  test("metrics are in em", () => {
    expect(sans.metrics).toMatchObject({
      unitsPerEm: 1000,
      ascent: 0.92,
      descent: 0.262,
      capHeight: 0.7,
    });
  });
});
