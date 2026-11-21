import { describe, expect, test } from "bun:test";
import {
  circle,
  ease,
  font,
  Group,
  line,
  rect,
  Run,
  Shape,
  Text,
  morph,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { boxesOf, isLane, svg, type Model, type StrokeProps } from "svjeez/tools";
import { diagnose } from "../src/model/backend";

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
  node.lines.map((line) => line.runs.map((run) => [run.text, run.face.weight, run.face.italic]));

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

    expect(runs(textOf(model))).toEqual([[["a", 400, false]]]);
    expect(runs(textOf(model, "b"))).toEqual([[["b", 700, false]]]);
    expect(runs(textOf(model, "i"))).toEqual([[["c", 400, true]]]);
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
    ).toEqual([[["x", 700, false]]]);
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
    ).toEqual([[["x", 700, false]]]);
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

    expect(() =>
      made(() => (
        <Text key="t" font={regular} weight={700} size={10} fill="#000000">
          x
        </Text>
      )),
    ).toThrow(
      'Only Space Mono 400 is loaded. To use Space Mono 700, load it as well: font={await google.family("Space Mono", [{ weight: 400 }, { weight: 700 }])}',
    );

    expect(() =>
      made(() => (
        <Text key="t" font={space} weight={600} size={10} fill="#000000">
          x
        </Text>
      )),
    ).toThrow('google.family("Space Mono", [{ weight: 600 }, …])');
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
        ["Total ", 400, false],
        ["42", 700, false],
        [" items", 400, false],
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
        ["a ", 400, false],
        ["b", 700, false],
      ],
      [
        ["c", 700, false],
        [" d", 400, false],
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
          <Text font={space} size={10} fill="#000000">
            a
          </Text>
          <Text font={space} weight={700} size={10} fill="#000000">
            b
          </Text>
          <Text font={abeezee} size={10} fill="#000000">
            c
          </Text>
        </Group>
      )),
    );

    expect(out).toContain('aria-labelledby="t" font-family="\'Space Mono\'" font-weight="400">');
    expect(out.match(/font-family="'Space Mono'/g)).toHaveLength(1);
    expect(out).toContain('font-weight="700" font-size="10"');
    expect(out).toContain('y="9.2" font-family="\'ABeeZee\'" font-size="10"');
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

describe("text strokes", () => {
  const stroked = (stroke: Partial<StrokeProps>, props: { scale?: number } = {}) => (
    <Text
      key="t"
      font={space}
      size={20}
      fill="#000000"
      at={[50, 50]}
      stroke={{ color: "#ff0000", ...stroke }}
      {...props}
    >
      Hi
    </Text>
  );

  test("a track can change a text's stroke, and nothing is drawn under the fill unless asked", () => {
    const model = made(() => {
      const color = track<`#${string}`>("#ffffff").to("#ff0000", span(1, 1));
      const width = track(2).to(3, span(1, 1));

      return stroked({ color, width });
    });

    const node = textOf(model);

    expect(isLane(node.stroke!.color)).toBe(true);
    expect(isLane(node.stroke!.width)).toBe(true);
    expect(node.stroke).toMatchObject({ join: "sharp", under: false });

    const out = emit(model);

    expect(out).not.toContain("paint-order");
    expect(out).not.toContain("stroke-linejoin");
  });

  test("under draws the stroke below the fill, on text and shapes alike", () => {
    const text = emit(made(() => stroked({ under: true })));

    const shape = emit(
      made(() => <Shape geometry={rect(10, 10)} stroke={{ color: "#ff0000", under: true }} />),
    );

    expect(text).toContain('paint-order="stroke"');
    expect(shape).toContain('paint-order="stroke"');
  });

  test("under is the same in every state of a morph", () => {
    expect(() =>
      made(() => morph(stroked({ under: true }), stroked({ under: false }), span(1, 1))),
    ).toThrow("cap, join, dash, fixedWidth or under differs");
  });

  test("a fixedWidth stroke on scaled text keeps its width", () => {
    const out = emit(made(() => stroked({ fixedWidth: true }, { scale: 2 })));

    expect(out).toContain('vector-effect="non-scaling-stroke"');
  });

  test("the stroke is part of the text's box", () => {
    const bare = boxesOf(
      made(() => stroked({ width: 0 })),
      0,
    )["t"]!;

    const box = boxesOf(
      made(() => stroked({ width: 4 })),
      0,
    )["t"]!;

    expect(box.width).toBeCloseTo(bare.width + 4, 6);
    expect(box.height).toBeCloseTo(bare.height + 4, 6);
  });
});

describe("text along an outline", () => {
  const along = (extra: Partial<Parameters<typeof Text>[0]> = {}, text = "Hi") =>
    made(() => (
      <Text
        key="t"
        font={space}
        size={10}
        fill="#000000"
        along={line([0, 50], [180, 50])}
        {...extra}
      >
        {text}
      </Text>
    ));

  test("lowers to glyph positions along the path and a box around them", () => {
    const node = textOf(along());

    expect(node.along?.align).toBe("start");
    expect(node.lines[0]!.runs[0]!.at).toEqual([0, 50]);
    expect(node.box.x).toBeCloseTo(0, 3);
    expect(node.box.width).toBeCloseTo(12.24, 3);
    expect(node.box.height).toBeGreaterThan(10);
  });

  test("start and align place the text relative to a fraction of the path", () => {
    const node = textOf(along({ start: 0.5, align: "center" }));

    expect(node.lines[0]!.runs[0]!.at[0]).toBeCloseTo(83.88, 3);
  });

  test("emits a textPath on a path in defs, with startOffset and text-anchor", () => {
    const out = emit(along({ start: 0.5, align: "center" }));

    expect(out).toMatch(/<defs>\s*<path d="M0 50L180 50" id="\w+"\/>\s*<\/defs>/);
    expect(out).toMatch(/<text[^>]*text-anchor="middle"/);
    expect(out).toMatch(/<textPath href="#\w+" startOffset="90">Hi<\/textPath>/);
  });

  test("a start track animates startOffset", () => {
    const out = emit(along({ start: track(0).to(1, span(0, 1), ease.linear) }));

    expect(out).toContain('attributeName="startOffset"');
    expect(out).toContain('values="0;180"');
  });

  test("wraps tspans for styled runs inside the textPath", () => {
    const out = emit(
      made(() => (
        <Text key="t" font={space} size={10} fill="#000000" along={circle(30)}>
          a<Run weight={700}>b</Run>
        </Text>
      )),
    );

    expect(out).toMatch(/<textPath[^>]*><tspan>a<\/tspan><tspan[^>]*>b<\/tspan><\/textPath>/);
  });

  test("errors name what to change", () => {
    expect(() => along({ along: line([0, 0], [0, 0]) })).toThrow("has no length");
    expect(() => along({}, "x".repeat(40))).toThrow(
      /is 64\.8 longer than the outline it is set along \(.*\)\./,
    );
    expect(() => along({ width: 50 })).toThrow("takes no width");
    expect(() => along({}, "a\nb")).toThrow("takes one line, but its text has 2");
  });
});

describe("pre-measured runs", () => {
  const packed = font(Uint8Array.from([...Buffer.from("wOF2"), ...new Uint8Array(40)]), {
    family: "Packed",
  });

  const system = font.system("Helvetica Neue", { weight: 500, fallback: ["Arial", "sans-serif"] });

  const set = (face: typeof packed, advances: number[] | undefined, extra = {}) =>
    made(() => (
      <Text key="t" font={face} size={10} fill="#000000">
        <Run advances={advances} {...extra}>
          abc
        </Run>
      </Text>
    ));

  test("a WOFF2 font sets text from the advances it is given", () => {
    const model = set(packed, [5, 6, 7]);
    const node = textOf(model);

    expect(node.lines[0]!.runs[0]!.advances).toEqual([5, 6, 7]);
    expect(node.box.width).toBe(18);
    expect(node.lines[0]!.runs[0]!.outline).toBeUndefined();

    const needs = {
      name: "Outlines",
      supports: { ...svg.supports, unoutlinedText: { level: "none", note: "x" } as const },
    };

    expect(diagnose(model, needs).map((each) => each.feature)).toEqual(["unoutlinedText"]);
    expect(svg.emit(model)).toContain("font-family");
    expect(svg.emit(model)).toContain("abc");
  });

  test("a system family needs no font file and writes no @font-face", () => {
    const model = set(system, [4, 4, 4]);
    const out = svg.emit(model);

    expect(textOf(model).box.width).toBe(12);
    expect(out).not.toContain("@font-face");
    expect(out).toContain("'Helvetica Neue', Arial, sans-serif");
    expect(out).toContain('font-weight="500"');
  });

  test("advances wrap with the text and cut at the characters they belong to", () => {
    const model = made(() => (
      <Text key="t" font={system} size={10} width={9} fill="#000000">
        <Run advances={[4, 4, 4, 4]}>abcd</Run>
      </Text>
    ));

    expect(textOf(model).lines.map((line) => line.runs.map((run) => run.text))).toEqual([
      ["ab"],
      ["cd"],
    ]);
  });

  test("missing advances in a font that can't be measured say so", () => {
    for (const face of [packed, system])
      expect(() =>
        made(() => (
          <Text key="t" font={face} size={10} fill="#000000">
            hello
          </Text>
        )),
      ).toThrow(/a font svjeez can't measure, and gave no advances for it/);
  });

  test("advances must match the characters", () => {
    expect(() => set(packed, [5, 6])).toThrow("3 characters");
  });

  test("letterSpacing widens the layout and is written as letter-spacing", () => {
    const plain = made(() => (
      <Text key="t" font={regular} size={10} fill="#000000">
        abc
      </Text>
    ));

    const spaced = made(() => (
      <Text key="t" font={regular} size={10} letterSpacing={2} fill="#000000">
        abc
      </Text>
    ));

    expect(textOf(spaced).box.width).toBeCloseTo(textOf(plain).box.width + 6, 5);
    expect(textOf(spaced).lines[0]!.runs[0]!.letterSpacing).toBe(2);
    expect(textOf(spaced).lines[0]!.runs[0]!.outline).toBeDefined();
    expect(emit(spaced)).toContain('letter-spacing="2"');
    expect(emit(plain)).not.toContain("letter-spacing");
  });

  test("a run can space its own letters", () => {
    const model = made(() => (
      <Text key="t" font={regular} size={10} fill="#000000">
        a<Run letterSpacing={3}>bc</Run>
      </Text>
    ));

    expect(emit(model)).toContain('letter-spacing="3"');
  });
});
