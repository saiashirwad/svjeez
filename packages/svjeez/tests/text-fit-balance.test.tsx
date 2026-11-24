/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { Group, Text, font, scene } from "svjeez";
import { validateSvg } from "svjeez/frames";
import { svg, type Model } from "svjeez/tools";

const fixture = (name: string): URL => new URL(`./fixtures/${name}.ttf`, import.meta.url);
const regular = await font.load(fixture("ABeeZee-Regular"));
const italic = await font.load(fixture("ABeeZee-Italic"));
const black = await font.load(fixture("ArchivoBlack-Regular"));
const mono = await font.load(fixture("SpaceMono-Regular"));

const textOf = (model: Model.Scene, key = "t"): Model.TextNode => {
  const node = model.root.children.find((each) => each.key === key);

  if (node?.kind !== "text") throw new Error(`no text "${key}"`);

  return node;
};

describe("typography: letterSpacing, italic fallback, fit, balance", () => {
  test("font.measure supports letterSpacing without trailing space", () => {
    const plain = regular.measure("hello", 20);
    const spaced = regular.measure("hello", 20, { letterSpacing: 3 });

    expect(spaced).toBeCloseTo(plain + 4 * 3, 5);
    expect(regular.measure("A", 20, { letterSpacing: 5 })).toBeCloseTo(regular.measure("A", 20), 5);
  });

  test("italic without explicit weight resolves to the family's available italic face", async () => {
    const bytesReg = await readFile(fixture("ABeeZee-Regular"));
    const bytesItal = await readFile(fixture("ABeeZee-Italic"));

    const family = font.family(
      font(bytesReg, { family: "Serif", weight: 500 }),
      font(bytesReg, { family: "Serif", weight: 600 }),
      font(bytesItal, { family: "Serif", weight: 500, italic: true }),
    );

    const model = scene({ size: [200, 100], duration: 1, title: "Italic" }, () => (
      <Group>
        <Text key="up" font={family} size={18} fill="#000000">
          Upright
        </Text>
        <Text key="it" font={family} italic size={18} fill="#000000">
          Italic
        </Text>
      </Group>
    ));

    expect(textOf(model, "up").lines[0]!.runs[0]!.face).toMatchObject({
      weight: 500,
      italic: false,
    });
    expect(textOf(model, "it").lines[0]!.runs[0]!.face).toMatchObject({
      weight: 500,
      italic: true,
    });

    const bareItalic = font(bytesItal, { family: "Solo", weight: 500, italic: true });

    const bare = scene({ size: [200, 100], duration: 1, title: "Bare" }, () => (
      <Group>
        <Text key="t" font={bareItalic} size={18} fill="#000000">
          Solo italic
        </Text>
      </Group>
    ));

    expect(textOf(bare).lines[0]!.runs[0]!.face).toMatchObject({ weight: 500, italic: true });
  });

  test("Text fit shrinks size to fit width and line count, respecting minSize", () => {
    const model = scene({ size: [300, 200], duration: 1, title: "Fit" }, () => (
      <Group>
        <Text
          key="one"
          font={regular}
          fit={{ width: 120, maxSize: 48, minSize: 10 }}
          fill="#000000"
        >
          Siddharth Venkatraman
        </Text>
        <Text
          key="two"
          font={regular}
          fit={{ width: 120, maxSize: 32, minSize: 10, lines: 2 }}
          fill="#000000"
        >
          The Courtyard of the Royal Palace
        </Text>
        <Text
          key="clamped"
          font={regular}
          fit={{ width: 30, maxSize: 24, minSize: 14 }}
          fill="#000000"
        >
          Very Long Unbreakable Name
        </Text>
      </Group>
    ));

    const one = textOf(model, "one");
    expect(one.lines).toHaveLength(1);
    expect(one.box.width).toBeLessThanOrEqual(120.01);
    expect(one.size).toBeLessThan(48);
    expect(one.size).toBeGreaterThan(10);

    const two = textOf(model, "two");
    expect(two.lines.length).toBeLessThanOrEqual(2);
    expect(two.box.width).toBeLessThanOrEqual(120.01);

    const clamped = textOf(model, "clamped");
    expect(clamped.size).toBeCloseTo(14, 5);
  });

  test("Text balance evens wrapped line widths to avoid orphan words", () => {
    const phrase = "The Courtyard at Taj Falaknuma Palace";

    const greedy = scene({ size: [300, 200], duration: 1, title: "Greedy" }, () => (
      <Group>
        <Text key="t" font={mono} size={14} width={270} fill="#000000">
          {phrase}
        </Text>
      </Group>
    ));

    const balanced = scene({ size: [300, 200], duration: 1, title: "Balanced" }, () => (
      <Group>
        <Text key="t" font={mono} size={14} width={270} balance fill="#000000">
          {phrase}
        </Text>
      </Group>
    ));

    const gLines = textOf(greedy).lines;
    const bLines = textOf(balanced).lines;

    expect(bLines.length).toBe(gLines.length);
    const chars = (line: Model.TextLine) => line.runs.map((r) => r.text).join("").length;
    const gSpread = Math.abs(chars(gLines[0]!) - chars(gLines[1]!));
    const bSpread = Math.abs(chars(bLines[0]!) - chars(bLines[1]!));
    expect(bSpread).toBeLessThan(gSpread);
  });
});

describe("fonts: lazy loader, features, ligature subsetting and warnings", () => {
  test("font(() => bytes) defers decoding until first use and invokes loader once", async () => {
    const raw = await readFile(fixture("ABeeZee-Regular"));
    let loads = 0;

    const lazy = font(
      () => {
        loads++;

        return raw;
      },
      { family: "LazyABeeZee", weight: 400 },
    );

    expect(loads).toBe(0);
    expect(lazy.family).toBe("LazyABeeZee");
    expect(loads).toBe(0);

    const w = lazy.measure("Hello", 20);
    expect(loads).toBe(1);
    expect(w).toBeCloseTo(regular.measure("Hello", 20), 6);

    lazy.measure("World", 20);
    expect(loads).toBe(1);
  });

  test("features option emits font-feature-settings and keeps subset valid", async () => {
    const raw = await readFile(fixture("ABeeZee-Regular"));
    const lined = font(raw, { features: ["lnum", "tnum"] });

    const model = scene({ size: [200, 100], duration: 1, title: "Features" }, () => (
      <Group>
        <Text font={lined} size={18} fill="#000000">
          2026
        </Text>
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).toContain('font-feature-settings:"lnum","tnum"');
    expect(validateSvg(out).errors).toEqual([]);
  });

  test("ligature fonts subset cleanly and large fallback warnings name the face and reason", async () => {
    const model = scene({ size: [200, 100], duration: 1, title: "Lig" }, () => (
      <Group>
        <Text font={black} size={24} fill="#000000">
          firefly
        </Text>
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).not.toContain(black.href!);
    expect(validateSvg(out).errors).toEqual([]);

    const big = `data:font/ttf;base64,${"A".repeat(300 * 1024)}`;
    const sample = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>@font-face{font-family:'Cormorant';src:url(${big}) format('truetype');font-weight:500;font-style:italic/* subset-skip: contextual or mark positioning */}</style><text font-family="'Cormorant'">Hi</text></svg>`;
    const warnings = validateSvg(sample).warnings.join("\n");

    expect(warnings).toContain('Cormorant" 500 italic');
    expect(warnings).toContain("contextual or mark positioning");
  });

  test("font.metrics exposes capHeight and xHeight", () => {
    expect(regular.metrics.capHeight).toBeGreaterThan(0);
    expect(regular.metrics.xHeight).toBeGreaterThan(0);
    expect(italic.metrics.ascent).toBeGreaterThan(0);
  });
});
