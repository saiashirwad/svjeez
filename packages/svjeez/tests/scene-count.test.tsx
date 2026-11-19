import { describe, expect, test } from "bun:test";
import {
  Group,
  Run,
  Shape,
  Text,
  count,
  ease,
  font,
  morph,
  rect,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { renderFrames } from "svjeez/frames";
import { restyle } from "svjeez/page";
import {
  describe as described,
  SceneError,
  check,
  isLane,
  svg,
  valueAt,
  type Model,
  type TextChild,
  type TextContent,
  type TextProps,
} from "svjeez/tools";
import { jsxDEV } from "svjeez/jsx-dev-runtime";
import { formatOf, formatted, ticksOf } from "../src/author/count";
import { blendNumber, valueAt as sampleAt } from "../src/model/sample";
import { mixVec } from "../src/model/steps";
import { ease as modelEase } from "../src/model/time";

const mono = await font.load(new URL("./fixtures/JetBrainsMono.ttf", import.meta.url));

const made = (build: () => SceneElement, duration = 4, loop = true): Model.Scene =>
  scene({ size: [200, 60], duration, title: "Count", loop, still: 3.5 }, build);

const find = (model: Model.Scene, key: string): Model.SceneNode => {
  const visit = (node: Model.SceneNode): Model.SceneNode | undefined =>
    node.key === key
      ? node
      : node.kind === "group"
        ? node.children.map(visit).find(Boolean)
        : undefined;

  const found = visit(model.root);

  if (!found) throw new Error(`no node "${key}"`);

  return found;
};

const counted = (model: Model.Scene, key = "n") => {
  const node = find(model, key);

  if (node.kind !== "group" || !node.authored?.count) throw new Error("expected a count");

  return { node, ticks: node.authored.count.ticks };
};

const shownAt = (ticks: readonly { t: number; text: string }[], t: number): string =>
  ticks.findLast((tick) => tick.t <= t)!.text;

const glyphsAt = (model: Model.Scene, key: string, t: number) => {
  const { node } = counted(model, key);
  const inner = node.children[0]!;

  if (inner.kind !== "group") throw new Error("expected the clipped digits");
  const clip = inner.clip;

  if (clip === undefined || isLane(clip) || clip.kind !== "points")
    throw new Error("expected a clip");
  const [top, bottom] = [clip.points[0]![1], clip.points[2]![1]];
  const glyphs: { x: number; text: string }[] = [];

  const visit = (child: Model.SceneNode, [x, y]: Model.Vec): void => {
    const [dx, dy] = valueAt(child.at, t, mixVec);

    if (child.kind === "group") {
      for (const each of child.children) visit(each, [x + dx, y + dy]);

      return;
    }

    if (child.kind !== "text") return;

    for (const line of child.lines)
      for (const run of line.runs) {
        const at = run.at[1] + y + dy;

        if (at > top && at < bottom) glyphs.push({ x: run.at[0] + x + dx, text: run.text });
      }
  };

  for (const child of inner.children) visit(child, [0, 0]);

  return glyphs.sort((a, b) => a.x - b.x);
};

const drawnAt = (model: Model.Scene, key: string, t: number): string =>
  glyphsAt(model, key, t)
    .map((glyph) => glyph.text)
    .join("");

describe("format", () => {
  const as = (value: number, options = {}) => formatted(value, formatOf(options, "a <Text>"));

  test("rounds to its decimals and groups thousands", () => {
    expect(as(0)).toBe("0");
    expect(as(12345.4)).toBe("12,345");
    expect(as(1234567.891, { decimals: 2 })).toBe("1,234,567.89");
    expect(as(999.96, { decimals: 1 })).toBe("1,000.0");
    expect(as(12345, { separator: "" })).toBe("12345");
    expect(as(12345, { separator: " " })).toBe("12 345");
    expect(as(1234.5, { decimals: 1, point: ",", separator: "." })).toBe("1.234,5");
  });

  test("pads with zeros, signs negatives, and never shows -0", () => {
    expect(as(7, { pad: 2 })).toBe("07");
    expect(as(-1234)).toBe("-1,234");
    expect(as(-0.2)).toBe("0");
    expect(as(-0.04, { decimals: 1 })).toBe("0.0");
    expect(as(-5, { pad: 3 })).toBe("-005");
  });

  test("a format that can't be read says what it takes", () => {
    expect(() => formatOf({ decimals: 1.5 }, "x")).toThrow(
      "count() in x takes decimals from 0 to 10, got 1.5.",
    );
    expect(() => formatOf({ rate: 0 }, "x")).toThrow("needs a positive rate");
    expect(() => formatOf({ separator: "ab" }, "x")).toThrow("groups thousands with one character");
    expect(() => formatOf({ point: "," }, "x")).toThrow(
      'marks its decimals with "," and groups thousands with it too',
    );
  });
});

describe("ticks", () => {
  const lane = (to: number): Model.Lane<number> => ({
    kind: "lane",
    keys: [
      { t: 0, value: 0 },
      { t: 0.5, value: 0 },
      { t: 2.5, value: to, ease: modelEase.out },
    ],
  });

  test("each tick shows the value at its time, no faster than the rate, and the last shows where it ends", () => {
    const format = formatOf({ rate: 20 }, "x");
    const ticks = ticksOf(lane(12345), 3, format, "x");

    expect(ticks[0]).toEqual({ t: 0, text: "0" });
    expect(ticks.at(-1)!.text).toBe("12,345");

    for (const tick of ticks)
      expect(tick.text).toBe(formatted(sampleAt(lane(12345), tick.t, blendNumber), format));

    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!.t - ticks[i - 1]!.t).toBeGreaterThanOrEqual(1 / 20 - 1e-4);
      expect(ticks[i]!.text).not.toBe(ticks[i - 1]!.text);
    }
  });

  test("a slow count ticks when its number changes, not on the rate's beat", () => {
    const ticks = ticksOf(
      {
        kind: "lane",
        keys: [
          { t: 0, value: 0 },
          { t: 2, value: 4, ease: modelEase.linear },
        ],
      },
      3,
      formatOf({}, "x"),
      "x",
    );

    expect(ticks.map((tick) => [tick.t, tick.text])).toEqual([
      [0, "0"],
      [0.25, "1"],
      [0.75, "2"],
      [1.25, "3"],
      [1.75, "4"],
    ]);
  });
});

describe("a counting Text", () => {
  const scoreboard = (to = 12345, props = {}) =>
    made(() => (
      <Group>
        <Shape geometry={rect(200, 60)} fill="#FFFFFF" />
        <Text key="n" font={mono} size={20} at={[10, 10]} fill="#000000" {...props}>
          {count(track(0).to(to, span(0.5, 2), ease.out).rewind(0.4))}
        </Text>
      </Group>
    ));

  test("draws, at every time, the number its track holds then", () => {
    const model = scoreboard();
    const { ticks } = counted(model);

    for (const t of [0, 0.6, 0.9, 1.3, 2, 2.6, 3.7, 3.99])
      expect(drawnAt(model, "n", t)).toBe(shownAt(ticks, t));
    expect(shownAt(ticks, 3)).toBe("12,345");
  });

  test("its box is as wide as the widest number, so layout never moves for it", () => {
    const { node } = counted(scoreboard());

    expect(node.box.width).toBeCloseTo(mono.measure("12,345", 20), 3);
  });

  test("words around the count go with it, and align says which edge holds still", () => {
    const paid = (align: "start" | "end") =>
      made(() => (
        <Text key="n" font={mono} size={20} fill="#000000" align={align}>
          ${count(track(5).to(1500, span(0, 1), ease.linear))} paid
        </Text>
      ));

    const edges = (align: "start" | "end") =>
      [0, 1.5].map((t) => {
        const glyphs = glyphsAt(paid(align), "n", t);

        return [glyphs[0]!.x, glyphs.at(-1)!.x];
      });

    expect([0, 1.5].map((t) => drawnAt(paid("start"), "n", t))).toEqual(["$5 paid", "$1,500 paid"]);
    expect(counted(paid("start")).ticks.at(-1)!.text).toBe("$1,500 paid");

    const [start, end] = [edges("start"), edges("end")];

    expect(start[0]![0]).toBeCloseTo(start[1]![0]!, 6);
    expect(start[0]![1]).toBeLessThan(start[1]![1]!);
    expect(end[0]![1]).toBeCloseTo(end[1]![1]!, 6);
    expect(end[0]![0]).toBeGreaterThan(end[1]![0]!);
  });

  test("a count that never changes is plain text", () => {
    const node = find(
      made(() => (
        <Text key="n" font={mono} size={20} fill="#000000">
          {count(1234.5, { decimals: 1 })}%
        </Text>
      )),
      "n",
    );

    expect(node.kind).toBe("text");
    expect(node.kind === "text" && node.lines[0]!.runs[0]!.text).toBe("1,234.5%");
  });

  test("each digit column is one element whose glyphs sit in a list, moved by one stepped lane", () => {
    const out = svg.emit(scoreboard()).replace(/@font-face\{[^}]*\}/g, "");

    expect(out.match(/<text /g)).toHaveLength(6);
    expect(out).toMatch(/<text [^>]*x="[\d. ]+" y="[\d. ]+"[^>]*>0123456789<\/text>/);
    expect(out).not.toContain("<tspan");
    expect(out).toContain("animation-timing-function:steps(1)");
  });

  test("only the characters it shows are embedded", () => {
    const out = svg.emit(
      made(() => (
        <Text key="n" font={mono} size={20} fill="#000000">
          {count(track(0).to(30, span(0, 1), ease.linear))}
        </Text>
      )),
    );

    const face = font(Buffer.from(out.match(/base64,([^)]+)\)/)![1]!, "base64"));

    expect([..."0123456789"].every((char) => face.has(char))).toBe(true);
    expect(face.has(",")).toBe(false);
  });

  test("describe and check read it as text that counts", () => {
    const model = scoreboard();
    const said = described(model, [1.3]);

    expect(said.text).toContain(`n text`);
    expect(said.text).toContain(JSON.stringify(shownAt(counted(model).ticks, 1.3)));
    expect(said.text).toMatch(/n: shown throughout; count /);

    const once = made(() => (
      <Text key="n" font={mono} size={20} at={[10, 10]} fill="#000000">
        {count(track(0).to(50, span(0, 1)))}
      </Text>
    ));

    const seams = check(once).problems.filter((finding) => finding.code === "loop-seam");

    expect(seams.map((finding) => finding.message)).toEqual([
      '<Text> "n" shows "50" at the end and jumps to "0" when the loop starts again at 0s.',
    ]);
    expect(check(model).problems.filter((finding) => finding.severity !== "info")).toEqual([]);
  });

  test("the same count in every state of a morph moves with it; a different one is an error", () => {
    const state = (x: number, to: number) => (
      <Text key="n" font={mono} size={20} at={[x, 10]} fill="#000000">
        {count(track(0).to(to, span(0, 1)))}
      </Text>
    );

    const moved = made(() => morph(state(0, 50), state(80, 50), span(2, 1)));

    expect(counted(moved).ticks.at(-1)!.text).toBe("50");

    expect(() => made(() => morph(state(0, 50), state(80, 60), span(2, 1)))).toThrow(
      'morph() can\'t blend <Text> "n": it counts, and what it counts differs between states.',
    );
  });
});

describe("misuse", () => {
  const thrown = (build: () => SceneElement): SceneError => {
    try {
      made(build);
    } catch (error) {
      if (error instanceof SceneError) return error;
      throw error;
    }

    throw new Error("nothing was thrown");
  };

  const at = { fileName: "scene.tsx", lineNumber: 9, columnNumber: 5 };
  const untyped: TextChild = JSON.parse(JSON.stringify(count(1)));

  const text = (children: TextContent, props: Partial<TextProps> = {}) =>
    jsxDEV(
      Text,
      { key: "n", font: mono, size: 20, fill: "#000000", ...props, children },
      undefined,
      false,
      at,
    );

  test.each([
    [[count(1), count(2)], {}, '<Text> "n" holds 2 count()s, and a <Text> counts one number.'],
    [
      [
        "a",
        jsxDEV(Run, { children: "b" }, undefined, false, at),
        count(track(0).to(5, span(0, 1))),
      ],
      {},
      '<Text> "n" counts, so it holds strings around its count() and no <Run>s.',
    ],
    [
      jsxDEV(Run, { children: untyped }, undefined, false, at),
      {},
      '<Text> "n" holds a count() inside a <Run>, and a count goes straight in its <Text>.',
    ],
    [
      ["a\nb", count(1)],
      {},
      '<Text> "n" counts, and a counting <Text> draws one line, but its words hold a line break.',
    ],
    [
      count(1),
      { width: 40 },
      '<Text> "n" counts, and a count doesn\'t wrap, so it takes no width.',
    ],
    [count(1), { fill: undefined }, '<Text> "n" counts with no fill, so it paints nothing.'],
    [count(1, { decimals: -1 }), {}, 'count() in <Text> "n" takes decimals from 0 to 10, got -1.'],
    [
      count(track(0).to(Number.NaN, span(0, 1))),
      {},
      'count() in <Text> "n" reads NaN at 0.033s, which isn\'t a number it can show.',
    ],
  ])("%#: says what is wrong and where", (children, props, problem) => {
    const error = thrown(() => text(children, props));

    expect(error.problem).toBe(problem);
    expect(error.source).toEqual({ file: "scene.tsx", line: 9, column: 5 });
  });

  test("a glyph the font lacks is named", () => {
    const error = thrown(() => text(["\u2603", count(track(0).to(5, span(0, 1)))]));

    expect(error.problem).toContain("which has no glyph for");
  });
});

const browser = await (async () => {
  try {
    const { chromium } = await import("playwright-core");
    await (await chromium.launch()).close();

    return true;
  } catch {
    return false;
  }
})();

describe.if(browser)("in the browser", () => {
  const counting = made(() => (
    <Group>
      <Shape geometry={rect(200, 60)} fill="#FFFFFF" />
      <Text key="n" font={mono} size={20} at={[10, 10]} fill="#000000">
        {count(track(0).to(12345, span(0.5, 2), ease.out).rewind(0.4))}
      </Text>
    </Group>
  ));

  const fixed = (words: string) =>
    svg.emit(
      made(() => (
        <Group>
          <Shape geometry={rect(200, 60)} fill="#FFFFFF" />
          <Text key="n" font={mono} size={20} at={[10, 10]} fill="#000000">
            {words}
          </Text>
        </Group>
      )),
    );

  const paint = async (out: string, time: number) =>
    Buffer.from((await renderFrames(out, { times: [time], colorScheme: "light" })).frames[0]!.png);

  test("each frame draws exactly the digits of its time, and the still those of the still's time", async () => {
    const out = svg.emit(counting);
    const { ticks } = counted(counting);

    for (const t of [0.6, 1, 1.7, 3.8]) {
      const want = await paint(fixed(shownAt(ticks, t)), 0);

      expect((await paint(out, t)).equals(want)).toBe(true);
    }

    expect(
      (await paint(restyle(out, { still: true }), 0)).equals(
        await paint(fixed(shownAt(ticks, 3.5)), 0),
      ),
    ).toBe(true);
  });
});
