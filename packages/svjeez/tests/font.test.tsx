import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Glyphs, draw, font, render, validateSvg, type Child } from "svjeez";
import { Callout, code, flowchart } from "svjeez/extras";
import { contours, pathData } from "../src/font/glyf";
import { sfnt } from "../src/font/sfnt";
import { shaper } from "../src/font/shape";
import { subset } from "../src/font/subset";

const fixture = (name: string) => new URL(`../examples/fonts/${name}.ttf`, import.meta.url);
const sans = await font.load(fixture("ABeeZee-Regular"));
const italic = await font.load(fixture("ABeeZee-Italic"));
const mono = await font.load(fixture("SpaceMono-Regular"));
const monoBold = await font.load(fixture("SpaceMono-Bold"));
const black = await font.load(fixture("ArchivoBlack-Regular"));
const jetbrains = await font.load(fixture("JetBrainsMono"));

const scene = (child: Child) => render({ width: 200, height: 100, duration: 1, title: "Fonts" }, child);
const faces = (svg: string) => [...svg.matchAll(/@font-face\{font-family:([^;]+);[^}]*font-weight:(\d+);font-style:(\w+)\}/g)].map((m) => `${m[1]} ${m[2]} ${m[3]}`);

describe("font", () => {
  test("reads family, weight, style and a fallback from the file", () => {
    expect(sans).toMatchObject({ format: "ttf", family: "ABeeZee", weight: 400, style: "normal", fallback: ["sans-serif"] });
    expect(italic).toMatchObject({ family: "ABeeZee", style: "italic" });
    expect(monoBold).toMatchObject({ family: "Space Mono", weight: 700, fallback: ["monospace"] });
  });

  test("options override what the file says", async () => {
    const bytes = await readFile(fixture("ABeeZee-Regular"));
    expect(font(bytes, { family: "Body", weight: 500, style: "italic", fallback: ["Georgia", "serif"] })).toMatchObject({ family: "Body", weight: 500, style: "italic", fallback: ["Georgia", "serif"] });
  });

  test("the bytes become a base64 data URI with the font's media type", async () => {
    const bytes = await readFile(fixture("ABeeZee-Regular"));
    expect(sans.href.startsWith("data:font/ttf;base64,")).toBe(true);
    expect(Buffer.from(sans.href.split(",")[1]!, "base64").equals(bytes)).toBe(true);
    expect(sans.bytes).toBe(sans.href.length);
  });

  test("rejects what it cannot read", () => {
    expect(() => font(new Uint8Array(4))).toThrow("empty or truncated");
    expect(() => font(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 0, 0, 0, 0]))).toThrow("Unknown font format");
    expect(() => font(Uint8Array.from([...Buffer.from("ttcf"), 0, 1, 0, 0, 0, 0, 0, 1]))).toThrow("font collection");
  });

  test("a WOFF2 font embeds but cannot be measured or drawn", () => {
    const woff2 = font(Uint8Array.from([...Buffer.from("wOF2"), ...new Array(40).fill(0)]), { family: "Packed" });
    expect(woff2).toMatchObject({ format: "woff2", family: "Packed", weight: 400 });
    expect(woff2.href.startsWith("data:font/woff2;base64,")).toBe(true);
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
    expect(black.measure("fi", 100)).not.toBeCloseTo(black.measure("f", 100) + black.measure("i", 100), 1);
  });

  test("measure scales with size", () => {
    expect(sans.measure("Wave", 48)).toBeCloseTo(sans.measure("Wave", 24) * 2, 6);
  });

  test("metrics are in em", () => {
    expect(sans.metrics).toMatchObject({ unitsPerEm: 1000, ascent: 0.92, descent: 0.262, capHeight: 0.7 });
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

describe("fontFamily", () => {
  test("embeds a used font once, with its fallback in the attribute", () => {
    const svg = scene(
      <>
        <text fontFamily={sans}>One</text>
        <text fontFamily={sans}>Two</text>
      </>,
    );
    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
    expect(svg).toContain(`font-family="'ABeeZee', sans-serif"`);
  });

  test("a family embeds every face under its name", () => {
    const svg = scene(<text fontFamily={font.family(sans, italic)}>Hi</text>);
    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal", "'ABeeZee' 400 italic"]);
  });

  test("an unused font is not embedded", () => {
    void sans;
    expect(scene(<text fontFamily="monospace">Hi</text>)).not.toContain("@font-face");
  });

  test("works on a group, so its text inherits the font", () => {
    expect(faces(scene(<g fontFamily={mono}><text>Hi</text></g>))).toEqual(["'Space Mono' 400 normal"]);
  });

  test("the same file loaded twice embeds once", async () => {
    const again = await font.load(fixture("ABeeZee-Regular"));
    const svg = scene(
      <>
        <text fontFamily={sans}>A</text>
        <text fontFamily={again}>B</text>
      </>,
    );
    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("a family name cannot break out of the CSS string", async () => {
    const hostile = font(await readFile(fixture("ABeeZee-Regular")), { family: "x\n;}svg *{display:none}/*" });
    const style = /<style>([\s\S]*)<\/style>/.exec(scene(<text fontFamily={hostile}>Hi</text>))![1]!;
    expect(style).toContain("@font-face{font-family:'x\\a ;}svg *{display:none}/*'");
    expect(style).not.toContain("\n;}");
  });

  test("two different files claiming one family slot is an error", async () => {
    const impostor = font(await readFile(fixture("SpaceMono-Regular")), { family: "ABeeZee" });
    expect(() =>
      scene(
        <>
          <text fontFamily={sans}>A</text>
          <text fontFamily={impostor}>B</text>
        </>,
      ),
    ).toThrow("Two different fonts claim 'ABeeZee' 400 normal");
  });

  test("embeds only the glyphs the scene's text uses", () => {
    const embedded = (svg: string) => /url\(data:font\/ttf;base64,([^)]+)\)/.exec(svg)![1]!;
    const cut = Buffer.from(embedded(scene(<text fontFamily={sans}>Hi</text>)), "base64");
    expect(cut.length).toBeLessThan(sans.bytes / 4);
    const parsed = font(cut);
    expect(parsed).toMatchObject({ family: "ABeeZee", weight: 400 });
    expect(parsed.has("H") && parsed.has("i")).toBe(true);
    expect(parsed.has("Q")).toBe(false);
    expect(parsed.measure("Hi", 40)).toBeCloseTo(sans.measure("Hi", 40), 6);
  });

  test("the cut keeps pair kerning among the glyphs it keeps", () => {
    const cut = font(Buffer.from(/base64,([^)]+)\)/.exec(scene(<text fontFamily={sans}>AV To</text>))![1]!, "base64"));
    expect(cut.measure("AV", 100)).toBeCloseTo(sans.measure("AV", 100), 6);
    expect(cut.measure("To", 100)).toBeCloseTo(sans.measure("To", 100), 6);
  });

  test("text that forms ligatures embeds the whole font, so the browser can still form them", () => {
    expect(scene(<text fontFamily={black}>fi</text>)).toContain(black.href);
  });

  test("text that could meet contextual alternates or mark positioning embeds the whole font", () => {
    expect(scene(<text fontFamily={jetbrains}>a // b</text>)).toContain(jetbrains.href);
    expect(scene(<text fontFamily={sans}>{"e\u0301"}</text>)).toContain(sans.href);
    expect(scene(<text fontFamily={jetbrains}>POST /login</text>)).not.toContain(jetbrains.href);
  });

  test("with ligatures off, text draws one glyph per character and the font still cuts down", async () => {
    const plain = font(await readFile(fixture("ArchivoBlack-Regular")), { ligatures: false });
    expect(plain.path("fi", { size: 10 }).glyphs.map((glyph) => glyph.char)).toEqual(["f", "i"]);
    expect(plain.measure("fi", 100)).toBeCloseTo(plain.measure("f", 100) + plain.measure("i", 100), 6);
    expect(scene(<text fontFamily={plain}>fi</text>)).not.toContain(plain.href);
    const code = font(await readFile(fixture("JetBrainsMono")), { ligatures: false });
    const svg = scene(<text fontFamily={code}>{"a // b => c"}</text>);
    expect(svg).not.toContain(code.href);
    const cut = font(Buffer.from(/base64,([^)]+)\)/.exec(svg)![1]!, "base64"));
    expect(cut.has("=") && cut.has(">") && cut.has("/")).toBe(true);
  });

  test("the cut maps characters beyond the BMP", async () => {
    const bytes = new Uint8Array(await readFile(fixture("ABeeZee-Regular")));
    const parsed = sfnt(bytes);
    const real = shaper(parsed);
    const clef = "\u{1d11e}";
    const remapped = { ...real, glyph: (char: string) => real.glyph(char === clef ? "H" : char) };
    const cut = font(subset(bytes, parsed, remapped, real.kern, [`${clef}i`])!);
    expect(cut.has(clef) && cut.has("i")).toBe(true);
    expect(cut.has("H")).toBe(false);
  });

  test("subset: false embeds the whole file", async () => {
    const whole = font(await readFile(fixture("ABeeZee-Regular")), { subset: false });
    expect(scene(<text fontFamily={whole}>Hi</text>)).toContain(whole.href);
  });

  test("a later copy of the same file with subset: false still embeds it whole", async () => {
    const whole = font(await readFile(fixture("ABeeZee-Regular")), { subset: false });
    const svg = scene(
      <>
        <text fontFamily={sans}>A</text>
        <text fontFamily={whole}>B</text>
      </>,
    );
    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
    expect(svg).toContain(whole.href);
  });

  test("a large embedded font warns", () => {
    const big = font(Uint8Array.from([...Buffer.from("wOF2"), ...new Array(200_000).fill(7)]), { family: "Big" });
    expect(validateSvg(scene(<text fontFamily={big}>Hi</text>)).warnings.join("\n")).toContain("An embedded font is");
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
    const ys = (d: string) => [...d.matchAll(/-?\d+(?:\.\d+)? (-?\d+(?:\.\d+)?)/g)].map((m) => Number(m[1]));
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
    expect(contours(sans.path("é", { size: 20 }).d)).toBeGreaterThan(contours(sans.path("e", { size: 20 }).d));
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
    const tables = new Map([["head", 0], ["loca", 64], ["glyf", 256]]);
    const lengths = new Map<string, number>();
    expect(() => contours({ view, tables, lengths }, 0)).toThrow("too many components");
  });

  test("needs a positive size", () => {
    expect(() => sans.path("a", { size: 0 })).toThrow("positive size");
  });
});

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

describe("extras with a font", () => {
  test("code() takes its column width from a monospaced font and embeds it", () => {
    const block = code("let x = 1", { font: mono, fontSize: 20 });
    expect(block.metrics.advance).toBeCloseTo(mono.measure("x", 20), 6);
    expect(faces(scene(block.node))).toEqual(["'Space Mono' 400 normal"]);
  });

  test("code() rejects a proportional font", () => {
    expect(() => code("x", { font: sans })).toThrow("needs a monospaced font");
  });

  test("diagram chips fit their measured labels", () => {
    const width = (label: string) => flowchart({ nodes: { a: label }, edges: [] }, { font: sans }).bounds.w;
    expect(width("WWWW") - width("iiii")).toBeCloseTo(sans.measure("WWWW", 14) - sans.measure("iiii", 14), 3);
    expect(faces(scene(flowchart({ nodes: { a: "A" }, edges: [] }, { font: sans }).node))).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("without a font, extras keep the monospace estimate", () => {
    const width = (label: string) => flowchart({ nodes: { a: label }, edges: [] }).bounds.w;
    expect(width("WWWW")).toBe(width("iiii"));
  });

  test("a callout box fits its measured lines", () => {
    const target = flowchart({ nodes: { a: "A" }, edges: [] }).bounds;
    const box = (text: string) => Number(/<rect x="[^"]*" y="[^"]*" width="([^"]+)"/.exec(scene(<Callout target={target} during={{ at: 0, over: 1 }} font={sans}>{text}</Callout>))![1]);
    expect(box("WWW") - box("iii")).toBeCloseTo(sans.measure("WWW", 14) - sans.measure("iii", 14), 1);
  });
});
