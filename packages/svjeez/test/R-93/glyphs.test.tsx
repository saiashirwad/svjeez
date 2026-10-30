import { describe, expect, test } from "bun:test";
import { Glyphs, draw, font } from "svjeez";
import { mono, monoBold, sans, scene } from "../helpers/font";

describe("Glyphs", () => {
  test("draws one path per visible glyph, labelled with the text, and embeds no font", () => {
    const svg = scene(<Glyphs font={sans} text="Hi there" size={20} y={40} fill="#fff" />);
    expect(svg.match(/<path /g)?.length).toBe(7);
    expect(svg).toContain('aria-label="Hi there"');
    expect(svg).not.toContain("@font-face");
  });

  test("a function animation runs once per glyph with its index", () => {
    const seen: [string, number][] = [];

    const svg = scene(
      <Glyphs
        font={sans}
        text="ab c"
        size={20}
        stroke="#fff"
        animation={(glyph, i) => {
          seen.push([glyph.char, i]);

          return draw({ at: i * 0.1, over: 0.5 });
        }}
      />,
    );

    expect(seen).toEqual([
      ["a", 0],
      ["b", 1],
      ["c", 3],
    ]);
    expect(svg.match(/pathLength="1"/g)?.length).toBe(3);
  });

  test("from a family, picks the face by weight", () => {
    const family = font.family(mono, monoBold);
    const bold = scene(<Glyphs font={family} weight={700} text="a" size={20} />);
    expect(bold).toBe(scene(<Glyphs font={monoBold} text="a" size={20} />));
  });
});
