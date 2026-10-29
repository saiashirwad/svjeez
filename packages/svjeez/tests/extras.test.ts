import { describe, expect, test } from "bun:test";
import { el, rect, render, validateSvg, type Motion, type SvgNode } from "svjeez";
import {
  Arrow,
  Brace,
  Callout,
  Camera,
  Focus,
  Marker,
  Underline,
  adaptive,
  variables,
  code,
  cut,
  shot,
  defaultDark,
  defaultLight,
  morph,
  type Morphable,
  type MorphPiece,
  readingTime,
  reveal,
  terminal,
  timeline,
  travel,
  typewriter,
  visible,
  appWindow,
  flow,
  tomorrow,
} from "svjeez/extras";
import { fit } from "../src/extras/camera";
import { match } from "../src/extras/morph";

describe("code", () => {
  const c = code([[{ content: "ab" }, { content: "cd" }], [{ content: "x cd" }]], {
    x: 10,
    y: 20,
    fontSize: 10,
    lineHeight: 2,
    advance: 6,
  });

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
    expect(
      c.words.filter((w) => w.line === 2).map(({ text, column, x }) => ({ text, column, x })),
    ).toEqual([
      { text: "x", column: 1, x: 10 },
      { text: "cd", column: 3, x: 22 },
    ]);
  });

  test("runs carry a role's theme color and an id that get() bounds", () => {
    const theme = { ...defaultDark, base0D: "#00f" } as const;

    const named = code(
      [
        ["  ", ["fn", "f(a,", "call"]],
        [["fn", "b)", "call"], " x"],
      ],
      { advance: 6, fontSize: 10, lineHeight: 2, theme },
    );

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
    expect([tl.intro, tl.body, tl.duration]).toEqual([
      { at: 0, over: 4 },
      { at: 4.5, over: 6 },
      10.5,
    ]);
  });

  test("a timeline starting inside another's scene lays out its beats from there", () => {
    const outer = timeline({ intro: 2, body: 6 }, { gap: 1 });
    const beats = timeline({ setup: 1, punchline: 2 }, { at: outer.body.at, gap: 0.5 });
    expect([beats.setup, beats.punchline, beats.duration, beats.end]).toEqual([
      { at: 3, over: 1 },
      { at: 4.5, over: 2 },
      3.5,
      6.5,
    ]);
  });

  test("readingTime holds for words / wps + settle, at least min", () => {
    expect(readingTime("one two three four five six seven")).toBe(3);
    expect(
      readingTime(["one two three", "four five six seven"], { wps: 7, settle: 0, min: 0 }),
    ).toBe(1);
    expect(readingTime("hi")).toBe(2);
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
        at!.split(",").map((p) => ({
          at: parseFloat(p),
          value: block!.match(new RegExp(`(?:^|;)${prop}:([^;]+)`))?.[1],
        })),
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
      Marker({
        stops: [
          { during: { at: 0, over: 1 }, target: rect(0, 0, 10, 20) },
          { during: { at: 2, over: 1 }, target: rect(10, 10, 30, 40) },
        ],
      }),
    );

    expect(svg).not.toContain("<animate");
    expect(svg).toContain(
      ".a{animation-delay:-4s!important;animation-play-state:paused!important}",
    );
    const marker = /<rect [^>]*rx="6"[^>]*class="a (m\d+)"/;
    expect([
      frozen(svg, marker, "width", (4 / 6) * 100),
      frozen(svg, marker, "height", (4 / 6) * 100),
    ]).toEqual(["30px", "40px"]);
  });

  test("Focus freezes dimmed during its span with the focused rect lit", () => {
    const svg = render(
      { width: 100, height: 100, duration: 6, title: "Focus", reducedMotion: { at: 3 } },
      Focus({
        stops: [{ during: { at: 2, over: 2 }, target: rect(0, 0, 10, 10) }],
        dim: 0.3,
        children: el.rect({ width: 10, height: 10 }),
      }),
    );

    expect(svg).not.toContain("<animate");
    expect(frozen(svg, /<rect [^>]*width="120%"[^>]*class="a (m\d+)"/, "opacity", 50)).toBe("0.3");
    expect(frozen(svg, /<mask[^>]*>\s*<rect[^>]*\/>\s*<g class="a (m\d+)"/, "opacity", 50)).toBe(
      "1",
    );
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

  test("variables() names each value as a CSS variable, with the light values under prefers-color-scheme: light", () => {
    const { vars, css } = variables(
      { sky: "#001", "ground-2": "#010" },
      { sky: "#ddf", "ground-2": "#dfd" },
    );

    expect(vars).toEqual({ sky: "var(--sky)", "ground-2": "var(--ground-2)" });
    expect(css).toBe(
      "svg{--sky:#001;--ground-2:#010}\n@media (prefers-color-scheme:light){svg{--sky:#ddf;--ground-2:#dfd}}",
    );
    expect(variables({ sky: "#001" }).css).toBe("svg{--sky:#001}");
  });

  test("variables() rejects a name that is not a CSS identifier", () => {
    expect(() => variables({ "not valid": "#000" })).toThrow(
      'variables() needs CSS identifiers for names, got "not valid".',
    );
  });

  test("adaptive() emits one declaration per base16 slot, dark first", () => {
    const { css } = adaptive({ dark: defaultDark, light: defaultLight });

    const slots = (scheme: typeof defaultDark) =>
      Object.entries(scheme)
        .map(([slot, color]) => `--${slot}:${color}`)
        .join(";");

    expect(css).toBe(
      `svg{${slots(defaultDark)}}\n@media (prefers-color-scheme:light){svg{${slots(defaultLight)}}}`,
    );
  });
});

describe("terminal", () => {
  const metrics = { x: 10, y: 20, fontSize: 10, lineHeight: 2, advance: 6 };

  test("a session stacks each command and its output, and ends after the last command types", () => {
    const shell = terminal([{ cmd: "ls", output: ["a", "b"] }, { cmd: "pwd" }], {
      ...metrics,
      at: 1,
      cps: 10,
      think: 0.5,
      gap: 0.5,
    });

    expect(shell.bounds).toMatchObject({ x: 10, y: 20, h: 80 });
    expect(shell.end).toBeCloseTo(1 + 0.4 + 0.5 + 0.12 + 0.5 + 0.5 + 0.5, 5);
    expect(() => terminal([])).toThrow();
  });

  test("a window's body starts under its title bar", () => {
    expect(appWindow(rect(0, 0, 100, 80), { bar: 30 }).body).toMatchObject({
      x: 0,
      y: 30,
      w: 100,
      h: 50,
    });
  });
});

test("a run renamed under the same id cross-fades: both texts render, each animated", () => {
  const a = code([[["fn", "useState", "hook"]]]);
  const b = code([[["fn", "useReducer", "hook"]]]);

  const svg = render(
    { width: 100, height: 100, duration: 4, title: "morph" },
    morph([a, b], { at: [1] }).node,
  );

  for (const word of ["useState", "useReducer"])
    expect(svg).toMatch(new RegExp(`<text[^>]*class="a [^"]*"[^>]*>${word}</text>`));
});

test("morph reports when each transition runs and when the last settles", () => {
  const [a, b, c] = [code([[["fn", "a"]]]), code([[["fn", "b"]]]), code([[["fn", "c"]]])];
  const two = morph([a, b, c], { at: [1, 3], over: 0.5 });
  expect(two.spans).toEqual([
    { at: 1, over: 0.5 },
    { at: 3, over: 0.5 },
  ]);
  expect(two.end).toBe(3.5);
  expect(morph([a], { at: [] })).toMatchObject({ spans: [], end: 0 });
});

test("a brace runs along the bottom or top of a target, and centers its label there", () => {
  const target = rect(100, 50, 80, 30);

  const draw = (side: "above" | "below") =>
    render(
      { width: 300, height: 200, duration: 4, title: "brace" },
      Brace({ target, side, label: "term", during: { at: 1, over: 2 } }),
    );

  const [below, above] = [draw("below"), draw("above")];
  expect(below).toContain('d="M100 88q0 8 8 8H132');
  expect(above).toContain('d="M100 42q0 -8 8 -8H132');
  expect(below).toMatch(/<text[^>]*x="140"[^>]*y="110"[^>]*>term/);
  expect(above).toMatch(/<text[^>]*x="140"[^>]*y="26"[^>]*>term/);
});

describe("morph over any Morphable", () => {
  const dots = (...pieces: MorphPiece[]): Morphable => ({
    words: pieces,
    draw: (p, animation) =>
      el.circle({ cx: p.x, cy: p.y, r: 2, class: `dot-${p.text}`, animation }),
  });

  test("a piece present in both versions travels, one only in the second fades in, and each is drawn by its own source", () => {
    const a = dots({ text: "k", x: 10, y: 10 });
    const b = dots({ text: "k", x: 50, y: 10 }, { text: "n", x: 80, y: 10 });

    const svg = render(
      { width: 100, height: 20, duration: 4, title: "dots" },
      morph([a, b], { at: [1], over: 1 }).node,
    );

    expect(svg.match(/class="[^"]*dot-k/g)).toHaveLength(1);
    expect(svg.match(/class="[^"]*dot-n/g)).toHaveLength(1);
    expect(svg).toMatch(/translate:40px 0px/);
  });

  test("a gutter needs code, because only code has lines to number", () => {
    const a = dots({ text: "k", x: 10, y: 10 });
    // SAFETY: the overloads reject this call at compile time, and a plain-JS caller would still reach the runtime check.
    expect(() => morph([a, a], { at: [1], gutter: true } as never)).toThrow(/gutter only for code/);
  });
});

describe("errors name the call, the constraint and the value", () => {
  const span = { at: 0, over: 1 };
  test.each([
    ["Marker", () => Marker({ stops: [] }), "Marker() needs at least one stop, got none."],
    [
      "Marker over",
      () => Marker({ stops: [{ during: span, target: rect(0, 0, 1, 1) }], over: 0 }),
      "Marker() needs a positive over, got 0.",
    ],
    [
      "Focus",
      () => Focus({ stops: [], dim: 2, children: null }),
      "Focus() needs dim between 0 and 1, got 2.",
    ],
    [
      "typewriter",
      () => typewriter(code("a"), { at: -1 }),
      "typewriter() needs a non-negative start and a positive cps, got at -1 and cps 28.",
    ],
    ["terminal", () => terminal([]), "terminal() needs at least one command, got none."],
  ])("%s", (_, make, message) => {
    expect(make).toThrow(message);
  });
});

describe("accent color", () => {
  const scene = (node: ReturnType<typeof Marker>) =>
    render({ width: 100, height: 100, duration: 4, title: "accent" }, node);

  const [span, box] = [{ at: 0, over: 2 }, rect(10, 10, 30, 20)];

  const items = {
    Marker: (theme) => Marker({ theme, stops: [{ during: span, target: box }] }),
    Arrow: (theme) => Arrow({ theme, from: { x: 0, y: 0 }, to: { x: 50, y: 50 }, during: span }),
    Callout: (theme) => Callout({ theme, target: box, during: span, children: "hi" }),
    Brace: (theme) => Brace({ theme, target: box, during: span }),
    Underline: (theme) => Underline({ theme, target: box, during: span }),
    flow: (theme) =>
      flow(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        { theme, at: 0 },
      ).node,
  } satisfies Record<string, (theme?: typeof tomorrow) => ReturnType<typeof Marker>>;

  for (const [name, make] of Object.entries(items)) {
    test(`${name} takes its default color from the theme's base09`, () => {
      expect(scene(make(undefined))).toContain(defaultDark.base09);
      expect(scene(make(tomorrow))).toContain(tomorrow.base09);
      expect(scene(make(tomorrow))).not.toContain("#f6c96b");
    });
  }
});

describe("timed components render valid SVG that moves only inside their span", () => {
  const [span, box, duration] = [{ at: 2, over: 3 }, rect(10, 10, 30, 20), 10];

  const scene = (node: SvgNode) =>
    render({ width: 100, height: 100, duration, title: "timing" }, node);

  /** When the first and last keyframe stop fall inside the loop, in seconds. The 0% and 100% stops are the loop's own. */
  const window = (svg: string): [number, number] => {
    const stops = [...svg.matchAll(/@keyframes [\w-]+\{((?:[^{}]*\{[^}]*\})*)\}/g)]
      .flatMap(([, body]) =>
        [...body!.matchAll(/([\d.%,]+)\{[^}]*\}/g)].flatMap(([, percents]) =>
          percents!.split(",").map(parseFloat),
        ),
      )
      .flatMap((percent) => (percent > 0 && percent < 100 ? [(percent * duration) / 100] : []));

    return [Math.min(...stops), Math.max(...stops)];
  };

  const items = {
    flow: [
      flow(
        [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        { at: span.at, over: span.over },
      ).node,
      [2, 5],
    ],
    Arrow: [Arrow({ from: { x: 0, y: 0 }, to: { x: 50, y: 50 }, during: span }), [2, 5]],
    Brace: [Brace({ target: box, during: span }), [2, 5]],
    Underline: [Underline({ target: box, during: span }), [2, 5]],
    Camera: [
      Camera({
        frame: rect(0, 0, 100, 100),
        stops: [{ during: span, target: box }],
        over: 0.5,
        children: el.rect({ width: 5, height: 5 }),
      }),
      [2, 2.5],
    ],
  } satisfies Record<string, [SvgNode, [number, number]]>;

  for (const [name, [node, [start, end]]] of Object.entries(items)) {
    test(name, () => {
      const svg = scene(node);
      expect(validateSvg(svg).errors).toEqual([]);
      const [first, last] = window(svg);
      expect(first).toBeCloseTo(start, 6);
      expect(last).toBeCloseTo(end, 6);
    });
  }
});

describe("time helpers", () => {
  type Held = { opacity?: number; x?: number; y?: number };

  /** What the rendered keyframes hold at playback second `t` of a 100s scene: opacity, and x and y from the translate lane. */
  const at = (track: Motion<"opacity" | "x" | "y" | "scale">, t: number): Held => {
    const svg = render(
      { width: 10, height: 10, duration: 100, title: "probe" },
      el.rect({ width: 1, height: 1, animation: track }),
    );

    const held: Held = {};

    for (const [, body] of svg.matchAll(/@keyframes [\w-]+\{((?:[^{}]*\{[^}]*\})*)\}/g)) {
      let stop: string | undefined;
      let latest = -1;

      for (const [, percents, declaration] of body!.matchAll(/([\d.%,]+)\{([^}]*)\}/g)) {
        for (const percent of percents!.split(",").map(parseFloat)) {
          if (percent <= t && percent >= latest) [stop, latest] = [declaration, percent];
        }
      }

      const translate = /translate:(-?[\d.]+)px (-?[\d.]+)px/.exec(stop ?? "");

      if (translate) Object.assign(held, { x: Number(translate[1]), y: Number(translate[2]) });
      const opacity = /opacity:([\d.]+)/.exec(stop ?? "");

      if (opacity) held.opacity = Number(opacity[1]);
      const visibility = /visibility:(hidden|visible)/.exec(stop ?? "");

      if (visibility) held.opacity = visibility[1] === "visible" ? 1 : 0;
    }

    return held;
  };

  test("visible is on during each span and stays on across gaps shorter than two fades", () => {
    const track = visible(
      [
        { at: 5, over: 1 },
        { at: 1, over: 1 },
        { at: 2.2, over: 0.8 },
      ],
      0.15,
    );

    expect([0.5, 1.5, 2.1, 2.5, 4, 5.5, 7].map((t) => at(track, t).opacity)).toEqual([
      0, 1, 1, 1, 0, 1, 0,
    ]);
  });

  test("cut is on only during its span, with no fade either side", () => {
    expect([0.9, 1.01, 2.99, 3.01].map((t) => at(cut({ at: 1, over: 2 }), t).opacity)).toEqual([
      0, 1, 1, 0,
    ]);
    expect([0, 0.5, 1.01].map((t) => at(cut({ at: 0, over: 1 }), t).opacity)).toEqual([1, 1, 0]);
  });

  test("a shot moves in and out inside its span, and cuts by default", () => {
    const risen = shot({ at: 10, over: 10 }, { enter: "rise", exit: "rise", over: 1 });
    expect([9.9, 15, 20.1].map((t) => at(risen, t).opacity)).toEqual([0, 1, 0]);
    expect([9.9, 15, 20.1].map((t) => at(risen, t).y)).toEqual([24, 0, -24]);
    expect([9.99, 10.01, 19.99, 20.01].map((t) => at(shot({ at: 10, over: 10 }), t).opacity)).toEqual([
      0, 1, 1, 0,
    ]);
    expect(at(shot({ at: 0, over: 5 }, { exit: "slide" }), 5.1).x).toBeCloseTo(-80);
    expect(() => shot({ at: 1, over: 0 })).toThrow("positive length");
  });

  test("a timeline's show fades a scene in and out, and its enter fades in and stays", () => {
    const tl = timeline({ intro: 4, body: 4 }, { fade: 0.5 });
    expect([3, 6, 50].map((t) => at(tl.show("body"), t).opacity)).toEqual([0, 1, 0]);
    expect([3, 6, 50].map((t) => at(tl.enter("body"), t).opacity)).toEqual([0, 1, 1]);
    expect(() => timeline({ enter: 1 })).toThrow('"enter" is reserved');
  });

  test("typewriter reports when each line types, a blank line taking only its newline", () => {
    const { spans, end } = typewriter(code("ab\n\ncde"), { at: 1, cps: 10 });
    expect(spans.map(({ at, over }) => [at, over].map((n) => Number(n.toFixed(9))))).toEqual([
      [1, 0.2],
      [1.3, 0],
      [1.4, 0.3],
    ]);
    expect(end).toBeCloseTo(spans.at(-1)!.at + spans.at(-1)!.over, 9);
  });

  test("travel crosses each leg at one speed, then hides", () => {
    const track = travel(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 300 },
      ],
      { at: 1, speed: 100 },
    );

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
    expect(shown.spans).toEqual([
      { at: 1, over: 0.4 },
      { at: 1.5, over: 0.4 },
    ]);
    expect(shown.end).toBeCloseTo(1.9, 9);
    expect(reveal(source, { at: [0.5, 3] }).spans.map((s) => s.at)).toEqual([0.5, 3]);
  });

  test("lines outside every block render unanimated, so a skeleton stays put", () => {
    const svg = render(
      { width: 100, height: 100, duration: 4, title: "reveal" },
      reveal(source, { at: 1, blocks: [[2], [4]] }).node,
    );

    expect(svg).toMatch(/<text(?![^>]*class=)[^>]*>class<\/text>/);
    expect(svg).toMatch(/<g class="[^"]+">\s*<text[^>]*>a<\/text>/);
  });

  test('one block per line with "line", and overlapping or out-of-range blocks throw', () => {
    expect(reveal(source, { at: 0, blocks: "line" }).spans).toHaveLength(5);
    expect(() =>
      reveal(source, {
        at: 0,
        blocks: [
          [1, 2],
          [2, 3],
        ],
      }),
    ).toThrow();
    expect(() => reveal(source, { at: 0, blocks: [[4, 9]] })).toThrow();
  });
});
