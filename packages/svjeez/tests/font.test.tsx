import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Group, Run, Text, font, scene, type SceneElement } from "svjeez";
import { svg, type FontValue } from "svjeez/tools";
import { validateSvg } from "svjeez/frames";
import { contours, pathData } from "../src/font/glyf";
import { required, sfnt, u16 } from "../src/font/sfnt";
import { typesetter } from "../src/font/shape";
import { subsetWithReason } from "../src/font/subset";
import { fontFixture, type FixtureFont } from "../../../fixtures/fonts";

const sans = await font.load(fontFixture("ABeeZee-Regular"));
const italic = await font.load(fontFixture("ABeeZee-Italic"));
const mono = await font.load(fontFixture("SpaceMono-Regular"));
const monoBold = await font.load(fontFixture("SpaceMono-Bold"));
const black = await font.load(fontFixture("ArchivoBlack-Regular"));
const jetbrains = await font.load(fontFixture("JetBrainsMono"));

const emit = (build: () => SceneElement) =>
  svg.emit(scene({ size: [200, 100], duration: 1, title: "Fonts" }, build));

const written = (value: FontValue, text: string) =>
  emit(() => (
    <Text font={value} size={10} fill="#000000">
      {text}
    </Text>
  ));

const faces = (out: string) =>
  [
    ...out.matchAll(/@font-face\{font-family:([^;]+);[^}]*font-weight:(\d+);font-style:(\w+)\}/g),
  ].map((m) => `${m[1]} ${m[2]} ${m[3]}`);

const cutOf = (out: string) => font(Buffer.from(/base64,([^)]+)\)/.exec(out)![1]!, "base64"));

describe("font", () => {
  test("reads family, weight, italic and a fallback from the file", () => {
    expect(sans).toMatchObject({
      format: "ttf",
      family: "ABeeZee",
      weight: 400,
      italic: false,
      fallback: ["sans-serif"],
    });
    expect(italic).toMatchObject({ family: "ABeeZee", italic: true });
    expect(monoBold).toMatchObject({ family: "Space Mono", weight: 700, fallback: ["monospace"] });
  });

  test("options override what the file says", async () => {
    const bytes = await readFile(fontFixture("ABeeZee-Regular"));
    expect(
      font(bytes, { family: "Body", weight: 500, italic: true, fallback: ["Georgia", "serif"] }),
    ).toMatchObject({
      family: "Body",
      weight: 500,
      italic: true,
      fallback: ["Georgia", "serif"],
    });
  });

  test("the bytes become a base64 data URI with the font's media type", async () => {
    const bytes = await readFile(fontFixture("ABeeZee-Regular"));
    expect(sans.href!.startsWith("data:font/ttf;base64,")).toBe(true);
    expect(Buffer.from(sans.href!.split(",")[1]!, "base64").equals(bytes)).toBe(true);
    expect(sans.bytes).toBe(sans.href!.length);
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

  test("a WOFF2 font embeds but cannot be measured or drawn", () => {
    const woff2 = font(Uint8Array.from([...Buffer.from("wOF2"), ...new Uint8Array(40)]), {
      family: "Packed",
    });

    expect(woff2).toMatchObject({ format: "woff2", family: "Packed", weight: 400 });
    expect(woff2.href!.startsWith("data:font/woff2;base64,")).toBe(true);
    expect(() => woff2.measure("Hi", 12)).toThrow("needs the TTF or OTF file");
    expect(() => woff2.path("Hi", { size: 12 })).toThrow("needs the TTF or OTF file");
  });

  test("measure applies pair kerning", () => {
    const apart = sans.measure("A", 100) + sans.measure("V", 100);
    expect(sans.measure("AV", 100)).toBeCloseTo(apart - 6.5, 5);
    expect(mono.measure("AV", 100)).toBeCloseTo(mono.measure("A", 100) * 2, 5);
  });

  test("measure applies standard ligatures", () => {
    expect(black.path("fi", { size: 10 }).glyphs.map((glyph) => glyph.char)).toEqual(["fi"]);
    expect(black.measure("fi", 100)).not.toBeCloseTo(
      black.measure("f", 100) + black.measure("i", 100),
      1,
    );
  });

  test("measure scales with size", () => {
    expect(sans.measure("Wave", 48)).toBeCloseTo(sans.measure("Wave", 24) * 2, 6);
  });

  test("metrics are in em", () => {
    expect(sans.metrics).toMatchObject({
      unitsPerEm: 1000,
      ascent: 0.92,
      descent: 0.262,
      capHeight: 0.7,
    });
  });

  test("has() reports missing glyphs", () => {
    expect(sans.has("a")).toBe(true);
    expect(sans.has("😀")).toBe(false);
  });

  test("a font is not a string", () => {
    expect(() => `${sans}`).toThrow("Pass it as fontFamily={font}");
    expect(() => `${font.family(sans, italic)}`).toThrow("fontFamily={family}");
  });
});

describe("font.family", () => {
  test("picks the face the browser would", () => {
    const family = font.family(mono, monoBold);
    expect(family.name).toBe("Space Mono");
    expect(family.face()).toBe(mono);
    expect(family.face(600)).toBe(monoBold);
    expect(family.face(400, true)).toBe(mono);
  });

  test("follows CSS weight matching when no face is exact", async () => {
    const bytes = await readFile(fontFixture("ABeeZee-Regular"));
    const at = (weight: number) => font(bytes, { family: "W", weight });
    const [w300, w500, w1000] = [at(300), at(500), at(1000)];
    expect(font.family(w300, w500).face(400)).toBe(w500);
    expect(font.family(w300, w1000).face(600)).toBe(w1000);
    expect(font.family(w500, w1000).face(350)).toBe(w500);
    expect(font.family(w300, w1000).face(450)).toBe(w300);
  });

  test("two faces in one weight and style slot are an error", () => {
    expect(() => font.family(sans, sans)).toThrow("two upright faces of weight 400");
  });
});

describe("embedding", () => {
  test("embeds a used font once", () => {
    const out = emit(() => (
      <Group>
        <Text font={sans} size={10} fill="#000000">
          One
        </Text>
        <Text font={sans} size={10} fill="#000000">
          Two
        </Text>
      </Group>
    ));

    expect(faces(out)).toEqual(["'ABeeZee' 400 normal"]);
    expect(out).toContain(`font-family="'ABeeZee'"`);
  });

  test("a family embeds each face drawn in it under its name, and no other", () => {
    const family = font.family(sans, italic);

    const both = emit(() => (
      <Text font={family} size={10} fill="#000000">
        Hi <Run italic>there</Run>
      </Text>
    ));

    expect(faces(both)).toEqual(["'ABeeZee' 400 normal", "'ABeeZee' 400 italic"]);
    expect(faces(written(family, "Hi"))).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("a scene with no text embeds no font", () => {
    expect(emit(() => <Group />)).not.toContain("@font-face");
  });

  test("the same file loaded twice embeds once", async () => {
    const again = await font.load(fontFixture("ABeeZee-Regular"));

    const out = emit(() => (
      <Group>
        <Text font={sans} size={10} fill="#000000">
          A
        </Text>
        <Text font={again} size={10} fill="#000000">
          B
        </Text>
      </Group>
    ));

    expect(faces(out)).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("a family name cannot break out of the CSS string", async () => {
    const hostile = font(await readFile(fontFixture("ABeeZee-Regular")), {
      family: "x\n;}svg *{display:none}/*",
    });

    const style = /<style>([\s\S]*)<\/style>/.exec(written(hostile, "Hi"))![1]!;

    expect(style).toContain("@font-face{font-family:'x\\a ;}svg *{display:none}/*'");
    expect(style).not.toContain("\n;}");
  });

  test("two different files claiming one family slot is an error", async () => {
    const impostor = font(await readFile(fontFixture("SpaceMono-Regular")), { family: "ABeeZee" });

    expect(() =>
      emit(() => (
        <Group>
          <Text font={sans} size={10} fill="#000000">
            A
          </Text>
          <Text font={impostor} size={10} fill="#000000">
            B
          </Text>
        </Group>
      )),
    ).toThrow("Two different fonts are both ABeeZee 400.");
  });

  test("embeds only the glyphs the scene's text uses", () => {
    const out = written(sans, "Hi");
    const cut = Buffer.from(/url\(data:font\/ttf;base64,([^)]+)\)/.exec(out)![1]!, "base64");
    expect(cut.length).toBeLessThan(sans.bytes / 4);
    const parsed = font(cut);
    expect(parsed).toMatchObject({ family: "ABeeZee", weight: 400 });
    expect(parsed.has("H") && parsed.has("i")).toBe(true);
    expect(parsed.has("Q")).toBe(false);
    expect(parsed.measure("Hi", 40)).toBeCloseTo(sans.measure("Hi", 40), 6);
  });

  test("the cut keeps pair kerning among the glyphs it keeps", () => {
    const cut = cutOf(written(sans, "AV To"));

    expect(cut.measure("AV", 100)).toBeCloseTo(sans.measure("AV", 100), 6);
    expect(cut.measure("To", 100)).toBeCloseTo(sans.measure("To", 100), 6);
  });

  test("text that forms ligatures subsets the font while keeping ligature substitution", () => {
    const out = written(black, "fi");
    expect(out).not.toContain(black.href!);
    const cut = cutOf(out);
    expect(cut.path("fi", { size: 10 }).glyphs).toHaveLength(1);
    expect(cut.measure("fi", 100)).toBeCloseTo(black.measure("fi", 100), 6);
  });

  test("text that could meet contextual alternates or mark positioning embeds the whole font", () => {
    expect(written(jetbrains, "a // b")).toContain(jetbrains.href!);
    expect(written(sans, "e\u0301")).toContain(sans.href!);
    expect(written(jetbrains, "POST /login")).not.toContain(jetbrains.href!);
  });

  test("with ligatures off, text draws one glyph per character and the font still cuts down", async () => {
    const plain = font(await readFile(fontFixture("ArchivoBlack-Regular")), { ligatures: false });
    expect(plain.path("fi", { size: 10 }).glyphs.map((glyph) => glyph.char)).toEqual(["f", "i"]);
    expect(plain.measure("fi", 100)).toBeCloseTo(
      plain.measure("f", 100) + plain.measure("i", 100),
      6,
    );
    expect(written(plain, "fi")).not.toContain(plain.href);
    const code = font(await readFile(fontFixture("JetBrainsMono")), { ligatures: false });
    const out = written(code, "a // b => c");
    expect(out).not.toContain(code.href);
    const cut = cutOf(out);
    expect(cut.has("=") && cut.has(">") && cut.has("/")).toBe(true);
  });

  test("the cut maps characters beyond the BMP", async () => {
    const bytes = new Uint8Array(await readFile(fontFixture("ABeeZee-Regular")));
    const parsed = sfnt(bytes);
    const real = typesetter(parsed);
    const clef = "\u{1d11e}";
    const remapped = { ...real, glyph: (char: string) => real.glyph(char === clef ? "H" : char) };
    const cut = font(subsetWithReason(bytes, parsed, remapped, [`${clef}i`]).bytes!);
    expect(cut.has(clef) && cut.has("i")).toBe(true);
    expect(cut.has("H")).toBe(false);
  });

  test("subset: false embeds the whole file", async () => {
    const whole = font(await readFile(fontFixture("ABeeZee-Regular")), { subset: false });
    expect(written(whole, "Hi")).toContain(whole.href!);
  });

  test("a large embedded font warns", () => {
    const big = `data:font/woff2;base64,${"A".repeat(300 * 1024)}`;

    const out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@font-face{font-family:'Big';src:url(${big}) format('woff2')}</style><text font-family="'Big'">Hi</text></svg>`;

    expect(validateSvg(out).warnings.join("\n")).toContain('The embedded font "Big" is 300 KB');
  });
});

describe("subset", () => {
  const load = async (name: FixtureFont) => {
    const bytes = new Uint8Array(await readFile(fontFixture(name)));
    const parsed = sfnt(bytes);

    return { bytes, parsed, real: typesetter(parsed, false) };
  };

  test("renumbers the kept glyphs and keeps every advance and the kerning of adjacent pairs", async () => {
    const { bytes, parsed, real } = await load("ABeeZee-Regular");
    const texts = ["To AVA", "Wave"];
    const cut = sfnt(subsetWithReason(bytes, parsed, real, texts).bytes!);
    const mine = typesetter(cut, false);
    const chars = [...new Set(texts.join(""))];

    expect(u16(cut, required(cut, "maxp") + 4)).toBe(1 + chars.length);
    expect([...cut.tables.keys()].sort()).toEqual(
      [
        "OS/2",
        "cmap",
        "cvt ",
        "fpgm",
        "gasp",
        "glyf",
        "head",
        "hhea",
        "hmtx",
        "kern",
        "loca",
        "maxp",
        "name",
        "post",
        "prep",
      ].sort(),
    );

    for (const text of texts)
      expect(mine.layoutGlyphs(text).map((glyph) => glyph.advance)).toEqual(
        real.layoutGlyphs(text).map((glyph) => glyph.advance),
      );

    const kerning = (t: typeof real, pair: string) => t.kern(t.glyph(pair[0]!), t.glyph(pair[1]!));
    expect(kerning(real, "AV")).not.toBe(0);
    expect(kerning(mine, "AV")).toBe(kerning(real, "AV"));
    expect(kerning(mine, "VA")).toBe(kerning(real, "VA"));

    const apart = chars
      .flatMap((left) => chars.map((right) => left + right))
      .filter((pair) => !texts.some((text) => text.includes(pair)) && kerning(real, pair) !== 0);

    expect(apart.length).toBeGreaterThan(0);

    for (const pair of apart) expect(kerning(mine, pair)).toBe(0);
  });

  test("a composite glyph keeps its components, renumbered, and draws the same outline", async () => {
    const { bytes, parsed, real } = await load("SpaceMono-Regular");
    const cut = sfnt(subsetWithReason(bytes, parsed, real, ["é"]).bytes!);
    const mine = typesetter(cut, false);

    expect(u16(cut, required(cut, "maxp") + 4)).toBeGreaterThan(2);
    expect(contours(cut, mine.glyph("é"))).toEqual(contours(parsed, real.glyph("é")));
    expect(contours(cut, mine.glyph("é")).length).toBeGreaterThan(1);
  });
});

describe("path", () => {
  test("returns one glyph per character, placed by advance, with the same width measure gives", () => {
    const run = sans.path("Wave", { size: 48, x: 10, y: 60 });
    expect(run.glyphs.map((glyph) => glyph.char)).toEqual(["W", "a", "v", "e"]);
    expect(run.glyphs[0]!.x).toBe(10);
    expect(run.glyphs[1]!.x).toBeCloseTo(10 + run.glyphs[0]!.advance, 6);
    expect(run.width).toBeCloseTo(sans.measure("Wave", 48), 6);
    expect(run.d).toBe(run.glyphs.map((glyph) => glyph.d).join(""));
  });

  test("outlines sit on the baseline and scale with size", () => {
    const ys = (d: string) =>
      [...d.matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));

    const small = ys(sans.path("H", { size: 10, y: 100 }).d);
    const big = ys(sans.path("H", { size: 100, y: 100 }).d);
    expect(Math.max(...small)).toBeCloseTo(100, 0);
    expect(100 - Math.min(...small)).toBeCloseTo(7, 0);
    expect(100 - Math.min(...big)).toBeCloseTo(70, 0);
  });

  test("a space has an advance and no outline", () => {
    const [, space] = sans.path("a b", { size: 20 }).glyphs;
    expect(space).toMatchObject({ char: " ", d: "" });
    expect(space!.advance).toBeGreaterThan(0);
  });

  test("a composite glyph such as é draws its base and its accent", () => {
    const contours = (d: string) => d.split("M").length - 1;
    expect(contours(sans.path("é", { size: 20 }).d)).toBeGreaterThan(
      contours(sans.path("e", { size: 20 }).d),
    );
  });

  test("a contour of only off-curve points closes through implied on-curve midpoints", () => {
    const ring = [
      { x: 0, y: 10, on: false },
      { x: 10, y: 0, on: false },
      { x: 0, y: -10, on: false },
      { x: -10, y: 0, on: false },
    ];

    expect(pathData([ring], 1, 0, 0)).toBe("M-5 -5Q0 -10 5 -5Q10 0 5 5Q0 10 -5 5Q-10 0 -5 -5Z");
  });

  test("composites that fan out exponentially throw instead of hanging", () => {
    const [fanout, levels] = [10, 9];
    const size = 10 + fanout * 6;
    const view = new DataView(new ArrayBuffer(256 + size * levels + 16));
    view.setInt16(50, 1);

    for (let g = 0; g <= levels + 1; g++) view.setUint32(64 + 4 * g, Math.min(g, levels) * size);

    for (let g = 0; g < levels; g++) {
      view.setInt16(256 + g * size, -1);

      for (let i = 0; i < fanout; i++) {
        const at = 256 + g * size + 10 + 6 * i;
        view.setUint16(at, (i < fanout - 1 ? 0x20 : 0) | 2);
        view.setUint16(at + 2, g + 1);
      }
    }

    const tables = new Map([
      ["head", { offset: 0, length: 64 }],
      ["loca", { offset: 64, length: 192 }],
      ["glyf", { offset: 256, length: view.byteLength - 256 }],
    ]);

    expect(() => contours({ view, tables }, 0)).toThrow("too many components");
  });

  test("needs a positive size", () => {
    expect(() => sans.path("a", { size: 0 })).toThrow("positive size");
  });
});
