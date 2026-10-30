import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { fixture, mono, monoBold, sans } from "../helpers/font";

describe("font.family", () => {
  test("picks the face the browser would", () => {
    const family = font.family(mono, monoBold);
    expect(family.name).toBe("Space Mono");
    expect(family.face()).toBe(mono);
    expect(family.face(600)).toBe(monoBold);
    expect(family.face(400, "italic")).toBe(mono);
  });

  test("follows CSS weight matching when no face is exact", async () => {
    const bytes = await readFile(fixture("ABeeZee-Regular"));
    const at = (weight: number) => font(bytes, { family: "W", weight });
    const [w300, w500, w1000] = [at(300), at(500), at(1000)];
    expect(font.family(w300, w500).face(400)).toBe(w500);
    expect(font.family(w300, w1000).face(600)).toBe(w1000);
    expect(font.family(w500, w1000).face(350)).toBe(w500);
    expect(font.family(w300, w1000).face(450)).toBe(w300);
  });

  test("two faces in one weight and style slot are an error", () => {
    expect(() => font.family(sans, sans)).toThrow("two normal faces of weight 400");
  });
});
