import { describe, expect, test } from "bun:test";
import { font } from "svjeez";

describe("font", () => {
  test("a WOFF2 font embeds but cannot be measured or drawn", () => {
    const woff2 = font(Uint8Array.from([...Buffer.from("wOF2"), ...new Uint8Array(40)]), {
      family: "Packed",
    });

    expect(woff2).toMatchObject({ format: "woff2", family: "Packed", weight: 400 });
    expect(woff2.href.startsWith("data:font/woff2;base64,")).toBe(true);
    expect(() => woff2.measure("Hi", 12)).toThrow("needs the TTF or OTF file");
    expect(() => woff2.path("Hi", { size: 12 })).toThrow("needs the TTF or OTF file");
  });
});
