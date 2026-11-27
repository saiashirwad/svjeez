import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  font,
  morph,
  rect,
  ref,
  scene,
  span,
  track,
  type Bounds,
  type SceneElement,
} from "svjeez";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { SceneError, describe as describeScene, check, svg } from "svjeez/tools";
import { Code, codeLayout, codeTokens, lines, ts, type CodeProps } from "../src/index.ts";
import { tomorrow } from "../src/palettes.ts";
import { fontFixture } from "../../../fixtures/fonts.ts";

const mono = await font.load(fontFixture("JetBrainsMono"));

const SOURCE = "const a = 1;\n\n  return a;";

const made = (build: (canvas: Bounds) => SceneElement, duration = 3, loop = true) =>
  scene({ size: [320, 120], duration, title: "Code", loop }, build);

const snippet = (extra: Partial<CodeProps> = {}) =>
  jsxDEV(
    Code,
    { lang: ts, font: mono, size: 16, palette: tomorrow, children: SOURCE, ...extra },
    undefined,
    false,
    { fileName: "scene.tsx", lineNumber: 9, columnNumber: 5 },
  );

const thrown = (build: () => SceneElement): SceneError => {
  try {
    made(build);
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("nothing was thrown");
};

describe("<Code>", () => {
  test("draws a text per line, keyed by line number, and skips an empty one", () => {
    const frame = describeScene(
      made(() => snippet({ key: "code", at: [10, 10] })),
      [0],
    ).frames[0]!;

    expect(frame.nodes.map(({ key, text }) => [key, text])).toEqual([
      ["code", undefined],
      ["code/line-1", "const a = 1;"],
      ["code/line-3", "return a;"],
    ]);
  });

  test("lines sit one line height apart", () => {
    const [, one, three] = describeScene(
      made(() => snippet({ key: "code", lineHeight: 2 })),
      [0],
    ).frames[0]!.nodes;

    expect(three!.box[1] - one!.box[1]).toBe(2 * 2 * 16);
  });

  test("colors come from the palette's tokens, so the scheme switches without baked hex", () => {
    const out = svg.emit(made(() => snippet()));

    expect(out).toContain("--tomorrow-keyword:#B294BB");
    expect(out).toContain("(prefers-color-scheme:light)");
    expect(out).toContain("--tomorrow-keyword:#8959A8");
    expect(out).not.toMatch(/fill="#[0-9A-Fa-f]{6}"/);
  });

  test("keys name lines, and the code takes the node's own props", () => {
    const code = ref();

    const frame = describeScene(
      made((canvas) => (
        <Group>
          {snippet({ key: "code", ref: code, keys: ["head", "gap", "tail"], at: [4, 4] })}
          <Shape
            key="marker"
            geometry={canvas.rect}
            fill="#000000"
            at={code.part("tail").topLeft}
          />
        </Group>
      )),
      [0],
    ).frames[0]!;

    expect(frame.nodes.map(({ key }) => key)).toContain("code/tail");
    expect(frame.nodes.find(({ key }) => key.endsWith("marker"))!.box.slice(0, 2)).toEqual([
      4,
      4 + 2 * 1.5 * 16,
    ]);
  });

  test("typing reveals the lines one after another over its span, one lane per line", () => {
    const scheme = made(() => snippet({ key: "code", typing: span(0.5, 1) }));
    const { timeline } = describeScene(scheme, [0]);

    expect(timeline.map(({ key, animates }) => [key, animates.map(({ value }) => value)])).toEqual([
      ["code/line-1", ["clip"]],
      ["code/line-3", ["clip"]],
    ]);

    const [first, last] = timeline.map(({ animates }) => animates[0]!.spans[0]!);

    expect(first![0]).toBeCloseTo(0.5);
    expect(first![1]).toBeCloseTo(last![0]);
    expect(last![1]).toBeCloseTo(1.5);

    const [early, late] = describeScene(scheme, [0.4, 1.6]).frames.map(({ nodes }) =>
      nodes.filter(({ kind }) => kind === "text").map(({ box }) => box[2]),
    );

    expect(early).toEqual([0, 0]);
    expect(late![0]).toBeGreaterThan(100);
  });

  test("typing steps by character, the same in the SVG as in the model", () => {
    const out = svg.emit(made(() => snippet({ typing: span(0, 1) })));

    expect(out).toContain("steps(12)");
    expect(out).toContain("steps(11)");
  });

  test("morph pairs lines by key: a kept line moves, a changed one crossfades", () => {
    const states = [
      snippet({ key: "code", keys: ["a", "b", "c"], at: [0, 0] }),
      snippet({
        key: "code",
        keys: ["c", "b", "a"],
        at: [0, 0],
        children: "return a;\n\nconst a = 1;",
      }),
    ];

    const out = made(() => morph.between(states, [span(1, 1)]), 3);

    expect(check(out).problems.filter(({ severity }) => severity === "error")).toEqual([]);

    const texts = (t: number) =>
      describeScene(out, [t]).frames[0]!.nodes.filter(({ kind }) => kind === "text");

    const moved = (t: number) => texts(t).find(({ text }) => text === "const a = 1;")!.box[1];

    expect(moved(0)).toBe(0);
    expect(moved(1.5)).toBeGreaterThan(0);
    expect(moved(1.5)).toBeLessThan(48);
    expect(moved(2.5)).toBe(48);
    expect(texts(1.5).filter(({ text }) => text === "return a;")).toHaveLength(2);
  });

  test("a scene of code checks clean", () => {
    const found = check(
      made(() => snippet({ at: [10, 10], typing: span(0, 1) }), 3, false),
    ).problems;

    expect(found.filter(({ severity }) => severity !== "info")).toEqual([]);
  });
});

describe("<Code> misuse", () => {
  test("a lang with no grammar names the line and says what to give", () => {
    const error = thrown(() => snippet({ lang: [] }));

    expect(error.source).toEqual({ file: "scene.tsx", line: 9, column: 5 });
    expect(error.node).toBe("<Code>");
    expect(error.message).toStartWith("scene.tsx:9:5: lang is an empty list of grammars.");
    expect(error.fix).toBe(
      "Give a grammar, such as ts from @svjeez/code, or a list that ends in one.",
    );
  });

  test("source that is not one string says how to write it", () => {
    const error = thrown(() =>
      jsxDEV(
        Code,
        {
          lang: ts,
          font: mono,
          size: 16,
          palette: tomorrow,
          // @ts-expect-error source is one string, as the type says
          children: ["a", "b"],
        },
        undefined,
        false,
        { fileName: "scene.tsx", lineNumber: 9, columnNumber: 5 },
      ),
    );

    expect(error.problem).toBe("<Code> holds something that is not one string of source code.");
    expect(error.fix).toBe("Write the code as one string: <Code …>{`const x = 1;`}</Code>.");
  });

  test("a bad size, line height or tab size is refused", () => {
    expect(thrown(() => snippet({ size: 0 })).problem).toBe("<Code> needs a positive size, got 0.");
    expect(thrown(() => snippet({ lineHeight: -1 })).problem).toBe(
      "<Code> needs a positive lineHeight, got -1.",
    );
    expect(thrown(() => snippet({ tabSize: 0 })).problem).toBe("tabSize is 0.");
  });

  test("keys need one per line", () => {
    const error = thrown(() => snippet({ keys: ["a", "b"] }));

    expect(error.problem).toBe("keys names 2 lines, but the code has 3.");
    expect(error.fix).toBe("Give one key per line, empty lines included.");
  });
});

describe("<Code by={codeTokens}>", () => {
  const texts = (built: ReturnType<typeof made>, t: number) =>
    describeScene(built, [t]).frames[0]!.nodes.filter(({ kind }) => kind === "text");

  test("draws one text per token, keyed by its text and occurrence, set at its measured column", () => {
    const nodes = texts(
      made(() => snippet({ key: "code", by: codeTokens })),
      0,
    );

    expect(nodes.map(({ key }) => key)).toEqual([
      "code/const#0",
      "code/a#0",
      "code/=#0",
      "code/1#0",
      "code/;#0",
      "code/return#0",
      "code/a#1",
      "code/;#1",
    ]);

    const at = (key: string) => nodes.find((node) => node.key === key)!.box;

    expect(at("code/a#0")[0]).toBeCloseTo(mono.measure("const ", 16), 0);
    expect(at("code/return#0")[0]).toBeCloseTo(mono.measure("  ", 16), 0);
    expect(at("code/return#0")[1]).toBe(2 * 1.5 * 16);
  });

  test("by={lines} is the default, and keys only name lines", () => {
    const keyed = (extra: Partial<CodeProps>) =>
      texts(
        made(() => snippet({ key: "code", ...extra })),
        0,
      ).map(({ key }) => key);

    expect(keyed({ by: lines })).toEqual(keyed({}));
    expect(thrown(() => snippet({ by: codeTokens, keys: ["a", "b", "c"] })).problem).toBe(
      "keys names lines, but this <Code> is split another way.",
    );
  });

  test("a morph moves the tokens both sources share, and fades the rest", () => {
    const states = ["const a = 1;", "let total = a + 1;"].map((source) =>
      snippet({ key: "code", by: codeTokens, children: source }),
    );

    const out = made(() => morph.between(states, [span(1, 1)]), 3);

    expect(check(out).problems.filter(({ severity }) => severity === "error")).toEqual([]);

    const x = (t: number, key: string) => texts(out, t).find((node) => node.key === key)?.box[0];

    expect(x(0, "code/a#0")).toBeCloseTo(mono.measure("const ", 16), 0);
    expect(x(2.5, "code/a#0")).toBeCloseTo(mono.measure("let total = ", 16), 0);
    expect(x(1.5, "code/a#0")).toBeGreaterThan(x(0, "code/a#0")!);
    expect(x(1.5, "code/a#0")).toBeLessThan(x(2.5, "code/a#0")!);
    expect(x(0, "code/total#0")).toBeUndefined();
    expect(x(2.5, "code/const#0")).toBeUndefined();
  });

  test("codeTokens.across keys by a diff, so dropping a line keeps the next one whole", () => {
    const [before, after] = ["a = 1;\nb = 2;", "b = 2;"];

    const keysOf = (source: string, by: CodeProps["by"]) =>
      texts(
        made(() => snippet({ key: "code", by, children: source })),
        0,
      ).map(({ key }) => key);

    const diffed = codeTokens.across(before, after);

    expect(keysOf(before, diffed)).toEqual(keysOf(before, codeTokens));
    expect(keysOf(after, codeTokens)).toEqual(["code/b#0", "code/=#0", "code/2#0", "code/;#0"]);
    expect(keysOf(after, diffed)).toEqual(["code/b#0", "code/=#1", "code/2#0", "code/;#1"]);
    expect(thrown(() => snippet({ by: diffed, children: "g();" })).problem).toBe(
      "This <Code>'s source is not one of the sources given to codeTokens.across().",
    );
  });

  test("codeTokens.across pairs a token that moved out of order with its nearest twin", () => {
    const diffed = codeTokens.across("f >>= fun key ->", "let key = f in");

    const keys = texts(
      made(() => snippet({ key: "code", by: diffed, children: "let key = f in" })),
      0,
    );

    expect(keys.map(({ key }) => key)).toEqual([
      "code/let#0",
      "code/key#0",
      "code/=#0",
      "code/f#0",
      "code/in#0",
    ]);
  });

  test("typing still types every token in order", () => {
    const { timeline } = describeScene(
      made(() => snippet({ key: "code", by: codeTokens, typing: span(0, 1) })),
      [0],
    );

    const spans = timeline
      .map(({ animates }) => animates[0]!.spans[0]!)
      .toSorted((a, b) => a[0] - b[0]);

    expect(spans).toHaveLength(8);
    expect(spans[0]![0]).toBeCloseTo(0);
    expect(spans.at(-1)![1]).toBeCloseTo(1);
    spans.slice(1).forEach((s, i) => expect(s[0]).toBeGreaterThanOrEqual(spans[i]![1] - 1e-9));
  });
});

describe("<Code part>", () => {
  const dimmed = (extra: Partial<CodeProps> = {}) =>
    made(() =>
      snippet({
        key: "code",
        by: codeTokens,
        part: (p) => (p.key === "return#0" ? {} : { opacity: 0.3 }),
        ...extra,
      }),
    );

  test("styles the chosen parts only", () => {
    const nodes = describeScene(dimmed(), [0]).frames[0]!.nodes;
    const opacity = (key: string) => nodes.find((node) => node.key === `code/${key}`)!.opacity ?? 1;

    expect(opacity("return#0")).toBe(1);
    expect(opacity("const#0")).toBeCloseTo(0.3);
    expect(opacity("a#1")).toBeCloseTo(0.3);
  });

  test("can animate, and composes with typing", () => {
    const built = made(() =>
      snippet({
        key: "code",
        typing: span(0, 1),
        part: () => ({ opacity: track(1).to(0.2, span(1, 1)) }),
      }),
    );

    const [, first] = describeScene(built, [0.5, 2]).frames[1]!.nodes;

    expect(first!.opacity).toBeCloseTo(0.2);
    expect(svg.emit(built)).toContain("opacity:0.2");
  });

  test("dims without tripping the low-contrast check that the same faint palette trips", () => {
    const faint = { ...tomorrow, plain: "#EEEEEE", keyword: "#EEEEEE" } as const;

    const problems = (props: Partial<CodeProps>) =>
      check(
        made(() => (
          <Group>
            <Shape key="back" geometry={rect(320, 120)} fill="#FFFFFF" />
            {snippet({ key: "code", palette: faint, ...props })}
          </Group>
        )),
      ).problems.map(({ code }) => code);

    expect(problems({})).toContain("low-contrast");
    expect(problems({ part: () => ({ opacity: 0.3 }) })).not.toContain("low-contrast");
  });
});

describe("codeLayout()", () => {
  const style = { font: mono, size: 16, lineHeight: 2, at: [10, 20] as const };
  const layout = codeLayout(style, SOURCE);
  const { ascent, descent } = mono.metrics;
  const lift = ((ascent + descent) * 16 - 32) / 2;

  test("points and boxes use the font's advances and <Code>'s line placement, 0-based", () => {
    expect(layout.lines).toEqual(["const a = 1;", "", "  return a;"]);
    expect(layout.point(0)).toEqual([10, 20 + lift]);
    expect(layout.point(2, 2)[0]).toBeCloseTo(10 + mono.measure("  ", 16));
    expect(layout.point(2, 2)[1]).toBeCloseTo(20 + 2 * 32 + lift);

    const box = layout.box(0, 6, 7);

    expect(box.x).toBeCloseTo(10 + mono.measure("const ", 16));
    expect(box.width).toBeCloseTo(mono.measure("a", 16));
    expect(box.height).toBe(32);
    expect(box.center[1]).toBeCloseTo(20 + ((ascent + descent) * 16) / 2);
    expect(layout.box(2).width).toBeCloseTo(mono.measure("  return a;", 16));
  });

  test("anchor puts a point of the block's bounds at `at`", () => {
    const top = codeLayout({ ...style, at: [100, 50], anchor: [0.5, 0] }, SOURCE);
    const width = mono.measure("const a = 1;", 16);

    expect(top.bounds.width).toBeCloseTo(width);
    expect(top.bounds.height).toBe(3 * 32);
    expect(top.origin[0]).toBeCloseTo(100 - width / 2);
    expect(top.bounds.y).toBeCloseTo(50);
    expect(top.box(0).y).toBeCloseTo(50);
    expect(top.bounds.center[0]).toBeCloseTo(100);
    expect(top.box(0).x).toBeCloseTo(top.origin[0]);

    const middle = codeLayout({ ...style, at: [100, 50], anchor: [1, 0.5] }, SOURCE);

    expect(middle.bounds.x + middle.bounds.width).toBeCloseTo(100);
    expect(middle.bounds.y + middle.bounds.height / 2).toBeCloseTo(50);
    expect(layout.origin).toEqual([10, 20]);
  });

  test("find() boxes a substring, by occurrence", () => {
    expect(layout.find("a")).toEqual(layout.box(0, 6, 7));
    expect(layout.find("a", 1)).toEqual(layout.box(2, 9, 10));
    expect(layout.find("return")).toEqual(layout.box(2, 2, 8));
  });

  test("the text's box sits inside its cell where <Code> draws it", () => {
    const built = made(() => snippet({ key: "code", at: [10, 20], lineHeight: 2, by: codeTokens }));

    const node = describeScene(built, [0]).frames[0]!.nodes.find(
      ({ key }) => key === "code/return#0",
    )!;

    const cell = layout.find("return");

    expect(node.box[0]).toBeCloseTo(cell.x, 0);
    expect(node.box[1] + node.box[3] / 2).toBeCloseTo(cell.center[1], 0);
  });

  test("a line, a column or a text it doesn't have is refused", () => {
    expect(() => layout.point(3)).toThrow("asks for line 3, but the code has lines 0 to 2.");
    expect(() => layout.box(0, 0, 40)).toThrow("asks for column 40 of line 0");
    expect(() => layout.find("b")).toThrow('looks for "b" number 0, but the code has it 0 times.');
  });
});
