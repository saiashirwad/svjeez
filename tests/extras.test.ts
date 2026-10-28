import { describe, expect, test } from "bun:test";
import { el, rect, render } from "svjeez";
import { Focus, Marker, adaptive, code, cut, defaultDark, defaultLight, morph, read, reveal, terminal, timeline, travel, typewriter, visible, window } from "svjeez/extras";
import { dataOf, type Motion } from "../src/motion";
import { keysOf, valueAt } from "../src/keys";
import { fit } from "../src/extras/camera";
import { match } from "../src/extras/morph";

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

  test("runs carry a role's theme color and an id that get() bounds", () => {
    const theme = { ...defaultDark, base0D: "#00f" } as const;
    const named = code([["  ", ["fn", "f(a,", "call"]], [["fn", "b)", "call"], " x"]], { advance: 6, fontSize: 10, lineHeight: 2, theme });
    expect(named.words.map((w) => w.color)).toEqual(["#00f", "#00f", undefined]);
    expect(named.get("call")).toMatchObject({ x: 0, y: 0, w: 36, h: 40 });
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

test("morph pairs runs by id before content, so a renamed word moves instead of fading", () => {
  const before = code([[["variable", "count", "n"], " = 1"]]).words;
  const after = code([["let ", ["variable", "total", "n"], " = 1"]]).words;
  expect(match(before, after)).toContainEqual([0, 1]);
});

describe("pacing", () => {
  test("pace scales scenes, not gaps", () => {
    const tl = timeline({ intro: 2, body: 3 }, { gap: 0.5, pace: 2 });
    expect([tl.intro, tl.body, tl.duration]).toEqual([{ at: 0, over: 4 }, { at: 4.5, over: 6 }, 10.5]);
  });

  test("a timeline starting inside another's scene lays out its beats from there", () => {
    const outer = timeline({ intro: 2, body: 6 }, { gap: 1 });
    const beats = timeline({ setup: 1, punchline: 2 }, { at: outer.body.at, gap: 0.5 });
    expect([beats.setup, beats.punchline, beats.duration, beats.end]).toEqual([{ at: 3, over: 1 }, { at: 4.5, over: 2 }, 3.5, 6.5]);
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

describe("themes", () => {
  test("adaptive colors are variables that switch to the light scheme under prefers-color-scheme: light", () => {
    const { theme, css } = adaptive({ dark: defaultDark, light: defaultLight });
    expect(theme.base00).toBe("var(--base00)");
    const [dark, light] = css.split("@media (prefers-color-scheme:light)");
    expect(dark).toContain(`--base00:${defaultDark.base00}`);
    expect(light).toContain(`--base00:${defaultLight.base00}`);
  });
});

describe("terminal", () => {
  const metrics = { x: 10, y: 20, fontSize: 10, lineHeight: 2, advance: 6 };

  test("a session stacks each command and its output, and ends after the last command types", () => {
    const shell = terminal([{ cmd: "ls", output: ["a", "b"] }, { cmd: "pwd" }], { ...metrics, at: 1, cps: 10, think: 0.5, gap: 0.5 });
    expect(shell.bounds).toMatchObject({ x: 10, y: 20, h: 80 });
    expect(shell.end).toBeCloseTo(1 + 0.4 + 0.5 + 0.12 + 0.5 + 0.5 + 0.5, 5);
    expect(() => terminal([])).toThrow();
  });

  test("a window's body starts under its title bar", () => {
    expect(window(rect(0, 0, 100, 80), { bar: 30 }).body).toMatchObject({ x: 0, y: 30, w: 100, h: 50 });
  });
});

test("a run renamed under the same id cross-fades: both texts render, each animated", () => {
  const a = code([[["fn", "useState", "hook"]]]);
  const b = code([[["fn", "useReducer", "hook"]]]);
  const svg = render({ width: 100, height: 100, duration: 4, title: "morph" }, morph([a, b], { at: [1] }).node);
  for (const word of ["useState", "useReducer"]) expect(svg).toMatch(new RegExp(`<text[^>]*class="a [^"]*"[^>]*>${word}</text>`));
});

describe("time helpers", () => {
  const at = (track: Motion, t: number) => valueAt(keysOf(dataOf(track).initial, dataOf(track).steps, 100), t);

  test("visible is on during each span and stays on across gaps shorter than two fades", () => {
    const track = visible([{ at: 5, over: 1 }, { at: 1, over: 1 }, { at: 2.2, over: 0.8 }], 0.15);
    expect([0.5, 1.5, 2.1, 2.5, 4, 5.5, 7].map((t) => at(track, t).opacity)).toEqual([0, 1, 1, 1, 0, 1, 0]);
  });

  test("cut is on only during its span, with no fade either side", () => {
    expect([0.9, 1.01, 2.99, 3.01].map((t) => at(cut({ at: 1, over: 2 }), t).opacity)).toEqual([0, 1, 1, 0]);
    expect([0, 0.5, 1.01].map((t) => at(cut({ at: 0, over: 1 }), t).opacity)).toEqual([1, 1, 0]);
  });

  test("typewriter reports when each line types, a blank line taking only its newline", () => {
    const { lines, end } = typewriter(code("ab\n\ncde"), { at: 1, cps: 10 });
    expect(lines.map(({ at, over }) => [at, over].map((n) => Number(n.toFixed(9))))).toEqual([[1, 0.2], [1.3, 0], [1.4, 0.3]]);
    expect(end).toBeCloseTo(lines.at(-1)!.at + lines.at(-1)!.over, 9);
  });

  test("travel crosses each leg at one speed, then hides", () => {
    const track = travel([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }], { at: 1, speed: 100 });
    expect(at(track, 0.5)).toMatchObject({ opacity: 0, x: 0, y: 0 });
    expect(at(track, 2)).toMatchObject({ opacity: 1, x: 100, y: 0 });
    expect(at(track, 5.5)).toMatchObject({ x: 100, y: 300, opacity: 0 });
    expect(() => travel([{ x: 1, y: 1 }], { at: 0 })).toThrow();
  });
});

describe("reveal", () => {
  const source = code("class A {\n  a = 1;\n\n  b() {}\n}");

  test("by default each paragraph enters in turn, a blank line joining the block after it", () => {
    const shown = reveal(source, { at: 1, step: 0.5, over: 0.4 });
    expect(shown.spans).toEqual([{ at: 1, over: 0.4 }, { at: 1.5, over: 0.4 }]);
    expect(shown.end).toBeCloseTo(1.9, 9);
    expect(reveal(source, { at: [0.5, 3] }).spans.map((s) => s.at)).toEqual([0.5, 3]);
  });

  test("lines outside every block render unanimated, so a skeleton stays put", () => {
    const svg = render({ width: 100, height: 100, duration: 4, title: "reveal" }, reveal(source, { at: 1, blocks: [[2], [4]] }).node);
    expect(svg).toMatch(/<text(?![^>]*class=)[^>]*>class<\/text>/);
    expect(svg).toMatch(/<g class="[^"]+">\s*<text[^>]*>a<\/text>/);
  });

  test("one block per line with \"line\", and overlapping or out-of-range blocks throw", () => {
    expect(reveal(source, { at: 0, blocks: "line" }).spans).toHaveLength(5);
    expect(() => reveal(source, { at: 0, blocks: [[1, 2], [2, 3]] })).toThrow();
    expect(() => reveal(source, { at: 0, blocks: [[4, 9]] })).toThrow();
  });
});
