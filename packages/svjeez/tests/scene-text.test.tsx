import { describe, expect, test } from "bun:test";
import { font, Group, Run, Text, morph, scene, span, track, type SceneElement } from "svjeez";
import { boxesOf, diagnose, isLane, svg, type Model } from "svjeez/tools";

const fixture = (name: string) => new URL(`./fixtures/${name}.ttf`, import.meta.url);
const regular = await font.load(fixture("SpaceMono-Regular"));
const bold = await font.load(fixture("SpaceMono-Bold"));
const space = font.family(regular, bold);
const sans = await font.load(fixture("ABeeZee-Regular"));
const sansItalic = await font.load(fixture("ABeeZee-Italic"));
const abeezee = font.family(sans, sansItalic);

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test" }, build);

const textOf = (model: Model.Scene, key = "t"): Model.TextNode => {
  const visit = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key === key
      ? node
      : node.kind === "group"
        ? node.children.map(visit).find(Boolean)
        : undefined;

  const found = visit(model.root);

  if (found?.kind !== "text") throw new Error(`no text "${key}"`);

  return found;
};

const runs = (node: Model.TextNode) =>
  node.lines.map((line) => line.runs.map((run) => [run.text, run.face.weight, run.face.style]));

const emit = (model: Model.Scene): string => svg.emit(model).replace(/@font-face\{[^}]*\}/g, "");

const embeds = (out: string) =>
  new Map(
    [
      ...out.matchAll(
        /url\(data:font\/ttf;base64,([^)]+)\)[^}]*font-weight:(\d+);font-style:(\w+)/g,
      ),
    ].map((m) => [`${m[2]} ${m[3]}`, font(Buffer.from(m[1]!, "base64"))]),
  );

describe("faces", () => {
  test("weight and italic pick a face of the family; 400 and upright unless asked", () => {
    const model = made(() => (
      <Group>
        <Text key="t" font={space} size={10} fill="#000000">
          a
        </Text>
        <Text key="b" font={space} weight={700} size={10} fill="#000000">
          b
        </Text>
        <Text key="i" font={abeezee} italic size={10} fill="#000000">
          c
        </Text>
      </Group>
    ));

    expect(runs(textOf(model))).toEqual([[["a", 400, "normal"]]]);
    expect(runs(textOf(model, "b"))).toEqual([[["b", 700, "normal"]]]);
    expect(runs(textOf(model, "i"))).toEqual([[["c", 400, "italic"]]]);
    expect(Object.keys(model.fonts)).toEqual(["Space Mono", "ABeeZee"]);
    expect(model.fonts["ABeeZee"]!.faces).toEqual([sansItalic]);
  });

  test("a single face is its own weight and style unless asked for another", () => {
    expect(
      runs(
        textOf(
          made(() => (
            <Text key="t" font={bold} size={10} fill="#000000">
              x
            </Text>
          )),
        ),
      ),
    ).toEqual([[["x", 700, "normal"]]]);
    expect(
      runs(
        textOf(
          made(() => (
            <Text key="t" font={bold} weight={700} size={10} fill="#000000">
              x
            </Text>
          )),
        ),
      ),
    ).toEqual([[["x", 700, "normal"]]]);
  });

  test("a face the font doesn't have is an error that says what it has", () => {
    expect(() =>
      made(() => (
        <Text key="t" font={space} weight={600} size={10} fill="#000000">
          x
        </Text>
      )),
    ).toThrow(
      `<Text> "t" asks for Space Mono 600, which its family doesn't have: it has 400, 700.`,
    );

    expect(() =>
      made(() => (
        <Text key="t" font={space} italic size={10} fill="#000000">
          x
        </Text>
      )),
    ).toThrow("asks for Space Mono 400 italic, which its family doesn't have");

    expect(() =>
      made(() => (
        <Text key="t" font={regular} size={10} fill="#000000">
          a <Run weight={700}>b</Run>
        </Text>
      )),
    ).toThrow(`<Text> "t" asks for Space Mono 700, but its font is the one face Space Mono 400.`);

    expect(() =>
      made(() => (
        <Text key="t" font={regular} italic size={10} fill="#000000">
          x
        </Text>
      )),
    ).toThrow("asks for Space Mono 400 italic, but its font is the one face Space Mono 400");
  });

  test("two different files can't be one family's same face", () => {
    const other = font.family(font.family(sans).faces[0]!, bold);

    expect(() =>
      made(() => (
        <Group>
          <Text font={space} size={10} fill="#000000">
            a
          </Text>
          <Text
            font={font(Buffer.from(require("node:fs").readFileSync(fixture("JetBrainsMono"))), {
              family: "Space Mono",
            })}
            size={10}
            fill="#000000"
          >
            b
          </Text>
        </Group>
      )),
    ).toThrow("Two different fonts are both Space Mono 400.");
    expect(other.faces).toHaveLength(2);
  });
});

describe("runs", () => {
  test("each run is measured with its own face and starts where the one before ends", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          Total <Run weight={700}>42</Run> items
        </Text>
      )),
    );

    expect(runs(node)).toEqual([
      [
        ["Total ", 400, "normal"],
        ["42", 700, "normal"],
        [" items", 400, "normal"],
      ],
    ]);
    const [a, b, c] = node.lines[0]!.runs;

    expect(b!.at[0]).toBeCloseTo(regular.measure("Total ", 10));
    expect(c!.at[0]).toBeCloseTo(regular.measure("Total ", 10) + bold.measure("42", 10));
    expect(b!.advances.reduce((x, y) => x + y)).toBeCloseTo(bold.measure("42", 10));
    expect(a!.outline!.length).toBeGreaterThan(0);
    expect(node.box.width).toBeCloseTo(
      regular.measure("Total ", 10) + bold.measure("42", 10) + regular.measure(" items", 10),
    );
  });

  test("spans nest, numbers are text, and a span that changes nothing joins the run around it", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          a<Run fill="#000000">b</Run>
          {3}
          <Run weight={700}>
            c<Run fill="#ff0000">d</Run>
          </Run>
          {String(3).length > 1 && <Run>never</Run>}
        </Text>
      )),
    );

    expect(node.lines[0]!.runs.map((run) => [run.text, run.face.weight, run.fill])).toEqual([
      ["ab3", 400, [0, 0, 0, 1]],
      ["c", 700, [0, 0, 0, 1]],
      ["d", 700, [1, 0, 0, 1]],
    ]);
  });

  test("spaces draw nothing, so they join the run beside them in the same face", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          <Run fill="#ff0000">x</Run> <Run fill="#ff0000">y</Run> <Run fill="#00ff00">z</Run>
        </Text>
      )),
    );

    expect(node.lines[0]!.runs.map((run) => run.text)).toEqual(["x y ", "z"]);
  });

  test("lines wrap at spaces across runs, a run can span a break, and a word that changes color wraps whole", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} width={50} fill="#000000">
          aa <Run weight={700}>bb cc dd</Run> e<Run fill="#ff0000">ff</Run> gg
        </Text>
      )),
    );

    expect(runs(node).map((line) => line.map(([text]) => text))).toEqual([
      ["aa ", "bb cc"],
      ["dd", " e", "ff"],
      ["gg"],
    ]);
    expect(
      node.lines.every(
        (line) =>
          line.runs.reduce((w, run) => w + run.advances.reduce((a, b) => a + b, 0), 0) <= 50,
      ),
    ).toBe(true);
    expect(node.lines[1]!.runs[0]!.at).toEqual([0, node.lines[1]!.at[1]]);
  });

  test("line breaks inside a span start a new line in the span's face", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} lineHeight={2} fill="#000000">
          a <Run weight={700}>{"b\nc"}</Run> d
        </Text>
      )),
    );

    expect(runs(node)).toEqual([
      [
        ["a ", 400, "normal"],
        ["b", 700, "normal"],
      ],
      [
        ["c", 700, "normal"],
        [" d", 400, "normal"],
      ],
    ]);
    expect(node.lines[1]!.at[1] - node.lines[0]!.at[1]).toBeCloseTo(20);
  });

  test("a span's fill and opacity animate on the scene's clock", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          a{" "}
          <Run
            fill={track<`#${string}`>("#000000").to("#ff0000", span(1, 1))}
            opacity={track(0).to(1, span(0, 1))}
          >
            b
          </Run>
        </Text>
      )),
    );

    const [, b] = node.lines[0]!.runs;

    expect(isLane(b!.fill) && [b!.fill.keys[0].value, b!.fill.keys.at(-1)!.value]).toEqual([
      [0, 0, 0, 1],
      [1, 0, 0, 1],
    ]);
    expect(
      isLane(b!.opacity!) && [b!.opacity.keys[0].value, b!.opacity.keys.at(-1)!.value],
    ).toEqual([0, 1]);
  });

  test("the box runs from the tallest ascent of any face to the deepest descent, and at places its top", () => {
    const node = textOf(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          a <Run font={abeezee}>b</Run>
        </Text>
      )),
    );

    const top = Math.max(regular.metrics.ascent, sans.metrics.ascent);
    const bottom = Math.max(regular.metrics.descent, sans.metrics.descent);

    expect(node.box.y).toBe(0);
    expect(node.lines[0]!.at[1]).toBeCloseTo(top * 10);
    expect(node.box.height).toBeCloseTo((top + bottom) * 10);
    expect(
      boxesOf(
        made(() => (
          <Text key="t" font={space} size={10} fill="#000000" at={[5, 50]}>
            a <Run font={abeezee}>b</Run>
          </Text>
        )),
      ).t!.y,
    ).toBeCloseTo(50);
    expect(
      boxesOf(
        made(() => (
          <Text key="t" font={space} size={10} fill="#000000" at={[5, 50]} anchor="baseline-left">
            a <Run font={abeezee}>b</Run>
          </Text>
        )),
      ).t!.y,
    ).toBeCloseTo(50 - top * 10);
  });

  test("a Text holds strings and Spans, and a Span draws only inside a Text", () => {
    expect(() => made(() => <Run weight={700}>x</Run>)).toThrow(
      "holds a <Run>, which draws only inside a <Text>",
    );
    expect(() =>
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000">
          a <Group />
        </Text>
      )),
    ).toThrow(`<Text> "t" holds a <Group>. A <Text> holds strings and <Run>s`);
  });

  test("a font svjeez can't outline draws as text and is named for a backend that needs outlines", async () => {
    const bytes = new Uint8Array(await Bun.file(fixture("SpaceMono-Regular")).arrayBuffer());

    bytes.set([0x4f, 0x54, 0x54, 0x4f], 0);
    const otf = font(bytes);

    expect([otf.format, otf.outlines, regular.outlines]).toEqual(["otf", false, true]);

    const model = made(() => (
      <Text key="t" font={otf} size={10} fill="#000000">
        Hi
      </Text>
    ));

    expect(textOf(model).lines[0]!.runs[0]!.outline).toBeUndefined();
    expect(emit(model)).toContain(">Hi<");

    const needs = {
      name: "Outlines",
      supports: { ...svg.supports, unoutlinedText: { level: "none", note: "x" } as const },
    };

    expect(diagnose(model, needs).map((each) => each.message)).toEqual([
      "<Text> \"t\" uses text in a font svjeez can't outline, which Outlines can't draw: x",
    ]);
  });

  test("a backend that needs outlines checks every run", () => {
    const model = made(() => (
      <Text key="t" font={space} size={10} fill="#000000">
        a <Run weight={700}>b</Run>
      </Text>
    ));

    const node = textOf(model);
    const [first, second] = node.lines[0]!.runs;
    const { outline: _, ...bare } = second!;

    const changed: Model.Scene = {
      ...model,
      root: {
        ...model.root,
        children: [{ ...node, lines: [{ ...node.lines[0]!, runs: [first!, bare] }] }],
      },
    };

    const backend = {
      name: "Outlines",
      supports: {
        ...svg.supports,
        unoutlinedText: { level: "none", note: "no fonts here." } as const,
      },
    };

    expect(diagnose(model, backend)).toEqual([]);
    expect(diagnose(changed, backend).map((each) => each.feature)).toEqual(["unoutlinedText"]);
    expect(diagnose(changed, backend)[0]!.message).toBe(
      "<Text> \"t\" uses text in a font svjeez can't outline, which Outlines can't draw: no fonts here.",
    );

    const plain = {
      name: "Plain",
      supports: { ...svg.supports, text: { level: "none", note: "no text." } as const },
    };

    expect(diagnose(model, plain).map((each) => each.feature)).toEqual(["text"]);
  });
});

describe("SVG", () => {
  test("one text, a tspan per run where layout put it, stating only what differs", () => {
    const out = emit(
      made(() => (
        <Text font={space} size={10} at={[10, 20]} anchor="baseline-left" fill="#000000">
          Total{" "}
          <Run weight={700} fill="#ff0000">
            42
          </Run>{" "}
          items
        </Text>
      )),
    );

    const text = out.match(/<text[^>]*>.*<\/text>/)![0];

    expect(text).toContain('<text font-family="\'Space Mono\'" font-size="10" fill="#000000">');
    expect(text).toContain('<tspan x="10" y="20">Total </tspan>');
    expect(text).toMatch(/<tspan x="[\d.]+" font-weight="700" fill="#FF0000">42<\/tspan>/);
    expect(text).toMatch(/<tspan x="[\d.]+"> items<\/tspan>/);
    expect(text.match(/font-family/g)).toHaveLength(1);
    expect(out).toContain('aria-labelledby="t" font-weight="400">');
  });

  test("each face's subset holds the characters drawn in it and no others", () => {
    const cut = embeds(
      svg.emit(
        made(() => (
          <Group>
            <Text font={space} size={10} fill="#000000">
              abc <Run weight={700}>XYZ</Run>
            </Text>
            <Text font={space} weight={700} size={10} fill="#000000">
              Q
            </Text>
          </Group>
        )),
      ),
    );

    expect(["a", "b", "c"].every((char) => cut.get("400 normal")!.has(char))).toBe(true);
    expect(["X", "Q"].some((char) => cut.get("400 normal")!.has(char))).toBe(false);
    expect(["X", "Y", "Z", "Q"].every((char) => cut.get("700 normal")!.has(char))).toBe(true);
    expect(cut.get("700 normal")!.has("a")).toBe(false);
  });

  test("a family no text draws in embeds nothing, and only the faces drawn in embed", () => {
    const out = svg.emit(
      made(() => (
        <Text font={space} weight={700} size={10} fill="#000000">
          b
        </Text>
      )),
    );

    expect([...embeds(out).keys()]).toEqual(["700 normal"]);
  });

  test("a family most texts share is stated once, on the root, and so is the regular weight", () => {
    const out = emit(
      made(() => (
        <Group>
          <Text font={space} size={10} anchor="baseline-left" fill="#000000">
            a
          </Text>
          <Text font={space} weight={700} size={10} anchor="baseline-left" fill="#000000">
            b
          </Text>
          <Text font={abeezee} size={10} anchor="baseline-left" fill="#000000">
            c
          </Text>
        </Group>
      )),
    );

    expect(out).toContain('aria-labelledby="t" font-family="\'Space Mono\'" font-weight="400">');
    expect(out.match(/font-family="'Space Mono'/g)).toHaveLength(1);
    expect(out).toContain('font-weight="700" font-size="10"');
    expect(out).toContain('<text font-family="\'ABeeZee\'" font-size="10"');
  });

  test("a run's animated fill and opacity land on its tspan", () => {
    const out = emit(
      made(() => (
        <Text font={space} size={10} fill="#000000">
          a <Run fill={track<`#${string}`>("#000000").to("#ff0000", span(1, 1))}>b</Run>{" "}
          <Run opacity={track(0).to(1, span(0, 1))}>c</Run>
        </Text>
      )),
    );

    expect(out).toMatch(/<tspan x="[\d.]+" fill="#000000" class="a m\d+">b <\/tspan>/);
    expect(out).toMatch(/<tspan x="[\d.]+" fill-opacity="0" class="a m\d+">c<\/tspan>/);
    expect(out).toMatch(/@keyframes k\d+\{.*\{fill:#FF0000\}/);
    expect(out).toMatch(/@keyframes k\d+\{.*\{fill-opacity:1\}/);
  });
});

describe("morph", () => {
  const label = (color: `#${string}`, words = "b") => (
    <Text key="t" font={space} size={10} fill="#000000">
      a <Run fill={color}>{words}</Run>
    </Text>
  );

  test("a run that changes color between states recolors", () => {
    const node = textOf(made(() => morph(label("#0000ff"), label("#ff0000"), span(0, 1))));
    const [a, b] = node.lines[0]!.runs;

    expect(a!.fill).toEqual([0, 0, 0, 1]);
    expect(isLane(b!.fill) && [b!.fill.keys[0].value, b!.fill.keys.at(-1)!.value]).toEqual([
      [0, 0, 1, 1],
      [1, 0, 0, 1],
    ]);
  });

  test("runs whose words or faces change crossfade", () => {
    const model = made(() => morph(label("#0000ff"), label("#0000ff", "c"), span(0, 1)));
    const group = model.root.children[0]!;

    expect(group.kind === "group" && group.children.map((child) => child.kind)).toEqual([
      "text",
      "text",
    ]);
  });
});
