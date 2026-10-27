import { describe, expect, test } from "bun:test";
import { el, rect, render } from "svg-motion";
import { Focus, Marker, code, read, timeline } from "svjeez/explain";
import { fit } from "../src/explain/camera";
import { match } from "../src/explain/morph";

describe("code", () => {
  const c = code([[{ content: "ab" }, { content: "cd" }], [{ content: "x cd" }]], { x: 10, y: 20, fontSize: 10, lineHeight: 2, advance: 6 });

  test("cells are advance wide and lineHeight × fontSize tall, 1-based", () => {
    expect(c.at(2, 3)).toEqual({ x: 22, y: 40 });
    expect(c.lines(1, 2)).toMatchObject({ x: 10, y: 20, w: 24, h: 40 });
    expect(() => c.at(3, 1)).toThrow();
  });

  test("find matches across token boundaries and counts occurrences", () => {
    expect(c.find("bc")).toMatchObject({ x: 16, y: 20, w: 12, h: 20 });
    expect(c.find("cd", 2)).toMatchObject({ x: 22, y: 40, w: 12 });
    expect(() => c.find("cd", 3)).toThrow();
  });

  test("words are the non-space runs, placed by column", () => {
    expect(c.words.filter((w) => w.line === 2).map(({ text, column, x }) => ({ text, column, x }))).toEqual([
      { text: "x", column: 1, x: 10 },
      { text: "cd", column: 3, x: 22 },
    ]);
  });

  test("a gutter shifts the code right by the digits plus two columns", () => {
    expect(code("a", { x: 10, advance: 6, gutter: true }).at(1, 1).x).toBe(28);
  });
});

describe("morph matching", () => {
  const sorted = (pairs: [number, number][]) => pairs.sort((p, q) => p[0] - q[0]);

  test("swapped words both move", () => {
    expect(sorted(match(code("a b").words, code("b a").words))).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });

  test("a line inserted above repeated words keeps each word on its own line", () => {
    const before = code("let x\nx").words;
    const after = code("x = 1\nlet x\nx").words;
    expect(sorted(match(before, after))).toEqual([
      [0, 3],
      [1, 4],
      [2, 5],
    ]);
  });
});

describe("pacing", () => {
  test("pace scales scenes, not gaps", () => {
    const tl = timeline({ intro: 2, body: 3 }, { gap: 0.5, pace: 2 });
    expect([tl.intro, tl.body, tl.duration]).toEqual([{ at: 0, over: 4 }, { at: 4.5, over: 6 }, 10.5]);
  });

  test("read holds for words / wps + settle, at least min", () => {
    expect(read("one two three four five six seven")).toBe(3);
    expect(read(["one two three", "four five six seven"], { wps: 7, settle: 0, min: 0 })).toBe(1);
    expect(read("hi")).toBe(2);
  });
});

test("camera fits and centers a view in a frame away from the origin", () => {
  const frame = rect(100, 50, 400, 200);
  const { x, y, scale } = fit(frame, rect(10, 10, 100, 100));
  expect(scale).toBe(2);
  expect({ x: x + 60 * scale, y: y + 60 * scale }).toEqual(frame.center);
  expect(y + 10 * scale).toBe(frame.y);
});

describe("reduced motion", () => {
  /** The value of `prop` that the CSS freeze shows at `percent`, read from the element's keyframes. */
  const frozen = (svg: string, element: RegExp, prop: string, percent: number): string => {
    const cls = svg.match(element)?.[1];
    const names = svg.match(new RegExp(`\\.${cls}\\{animation-name:([\\w,-]+)`))![1]!.split(",");
    for (const name of names) {
      const body = svg.match(new RegExp(`@keyframes ${name}\\{(.*)\\}$`, "m"))![1]!;
      const keys = [...body.matchAll(/([\d.%,]+)\{([^}]*)\}/g)].flatMap(([, at, block]) =>
        at!.split(",").map((p) => ({ at: parseFloat(p), value: block!.match(new RegExp(`(?:^|;)${prop}:([^;]+)`))?.[1] })),
      );
      const sorted = keys.sort((a, b) => a.at - b.at);
      const before = sorted.findLast((k) => k.at <= percent);
      const after = sorted.find((k) => k.at >= percent);
      if (before?.value !== undefined && before.value === after?.value) return before.value;
    }
    throw new Error(`${prop} is not holding at ${percent}%`);
  };

  test("an animated Marker freezes at its stop's size, with no SMIL", () => {
    const svg = render(
      { width: 100, height: 100, duration: 6, title: "Marker", reducedMotion: { at: 4 } },
      Marker({ stops: [{ at: { at: 0, over: 1 }, rect: rect(0, 0, 10, 20) }, { at: { at: 2, over: 1 }, rect: rect(10, 10, 30, 40) }] }),
    );
    expect(svg).not.toContain("<animate");
    expect(svg).toContain(".a{animation-delay:-4s!important;animation-play-state:paused!important}");
    const marker = /<rect [^>]*rx="6"[^>]*class="a (m\d+)"/;
    expect([frozen(svg, marker, "width", (4 / 6) * 100), frozen(svg, marker, "height", (4 / 6) * 100)]).toEqual(["30px", "40px"]);
  });

  test("Focus freezes dimmed during its span with the focused rect lit", () => {
    const svg = render(
      { width: 100, height: 100, duration: 6, title: "Focus", reducedMotion: { at: 3 } },
      Focus({ stops: [{ during: { at: 2, over: 2 }, on: rect(0, 0, 10, 10) }], dim: 0.3, children: el.rect({ width: 10, height: 10 }) }),
    );
    expect(svg).not.toContain("<animate");
    expect(frozen(svg, /<rect [^>]*width="120%"[^>]*class="a (m\d+)"/, "opacity", 50)).toBe("0.3");
    expect(frozen(svg, /<mask[^>]*>\s*<rect[^>]*\/>\s*<g class="a (m\d+)"/, "opacity", 50)).toBe("1");
  });
});
