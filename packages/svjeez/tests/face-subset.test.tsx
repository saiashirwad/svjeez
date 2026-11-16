import { describe, expect, test } from "bun:test";
import { Style, font, render, type Child } from "svjeez";

const fixture = (name: string) => new URL(`./fixtures/${name}.ttf`, import.meta.url);
const regular = await font.load(fixture("SpaceMono-Regular"));
const bold = await font.load(fixture("SpaceMono-Bold"));
const family = font.family(regular, bold);

const scene = (child: Child) =>
  render({ width: 200, height: 100, duration: 1, title: "Faces" }, child);

/** The font each embedded face carries, by weight. */
const embeds = (svg: string) =>
  new Map(
    [...svg.matchAll(/url\(data:font\/ttf;base64,([^)]+)\)[^}]*font-weight:(\d+)/g)].map((m) => [
      Number(m[2]),
      font(Buffer.from(m[1]!, "base64")),
    ]),
  );

describe("per-face subsetting", () => {
  test("each weight embeds only the glyphs drawn in it", () => {
    const svg = scene(
      <g>
        <text fontFamily={family} fontWeight={400}>
          abc
        </text>
        <text fontFamily={family} fontWeight={700}>
          XYZ
        </text>
      </g>,
    );

    const cut = embeds(svg);
    expect(cut.get(400)!.has("a") && cut.get(400)!.has("c")).toBe(true);
    expect(cut.get(400)!.has("X")).toBe(false);
    expect(cut.get(700)!.has("X") && cut.get(700)!.has("Z")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(false);
  });

  test("weight and style are inherited from ancestors, and a nearer one wins", () => {
    const svg = scene(
      <g fontFamily={family} fontWeight={700}>
        <text>XYZ</text>
        <text fontWeight="normal">abc</text>
      </g>,
    );

    const cut = embeds(svg);
    expect(cut.get(700)!.has("X")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(false);
    expect(cut.get(400)!.has("a")).toBe(true);
    expect(cut.get(400)!.has("X")).toBe(false);
  });

  test("a weight with no exact face goes to every face of the family", () => {
    const cut = embeds(
      scene(
        <text fontFamily={family} fontWeight={600}>
          abc
        </text>,
      ),
    );

    expect(cut.get(400)!.has("a")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(true);
  });

  test("a weight that cannot be read statically goes to every face", () => {
    const cut = embeds(
      scene(
        <text fontFamily={family} style="font-weight:bolder">
          abc
        </text>,
      ),
    );

    expect(cut.get(400)!.has("a")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(true);
  });

  test("a weight set by a class keeps the text in every face of its family", () => {
    const cut = embeds(
      scene(
        <g>
          <Style>{".heavy{font-weight:700}"}</Style>
          <text fontFamily={family} class="heavy">
            abc
          </text>
        </g>,
      ),
    );

    expect(cut.get(400)!.has("a")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(true);
  });

  test("text with an unknown family goes to every face", () => {
    const cut = embeds(
      scene(
        <g>
          <text fontFamily={family} fontWeight={400}>
            abc
          </text>
          <text>XYZ</text>
        </g>,
      ),
    );

    expect(cut.get(400)!.has("X")).toBe(true);
    expect(cut.get(700)!.has("X")).toBe(true);
    expect(cut.get(700)!.has("a")).toBe(false);
  });
});
