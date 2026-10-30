import { describe, expect, test } from "bun:test";
import { tex } from "../../src/index";
import { f } from "../helpers/tex";

describe("tex", () => {
  test("get() and find() return the rect of the part they name", () => {
    const g = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, { x: 40, y: 80, fontSize: 40 });
    const mid = g.get("mid");
    const box = ({ x, y, w, h }: typeof mid) => ({ x, y, w, h });
    expect(box(g.find("2ab"))).toEqual(box(mid));
    expect(g.find("b2").x).toBeGreaterThan(mid.x + mid.w);
    expect(g.find("2", 2)).toMatchObject({ x: g.words.filter((w) => w.char === "2")[1]!.bounds.x });
    expect(g.words.filter((w) => w.id === "mid").map((w) => w.char)).toEqual(["2", "a", "b"]);
  });

  test("find() reads through no glyph boundary, and says what it found", () => {
    expect(() => f.find("(a+")).not.toThrow();
    expect(() => f.find("zz")).toThrow(`tex.find() found 0 of "zz", not 1.`);
    expect(() => f.find("a", 2)).toThrow(`tex.find() found 1 of "a", not 2.`);
    expect(() => f.get("x")).toThrow(`tex.get() found no part named "x".`);
  });
});
