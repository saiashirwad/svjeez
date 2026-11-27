import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  InvalidValue,
  StaleSource,
  applySplices,
  assign,
  derive,
  discover,
  extract,
  guessRange,
  pad,
  valueOf,
  valuesOf,
  view,
  write,
  writeAll,
} from "../src/index.ts";
import type { Files, Signal, SignalKind, SignalValue, Signals } from "../src/index.ts";

const example = (name: string): Promise<Files> => {
  const path = new URL("../../../examples/" + name + "/index.tsx", import.meta.url).pathname;

  return Bun.file(path)
    .text()
    .then((text) => ({ [name + ".tsx"]: text }));
};

/** A scene with the local files it imports, keyed by path the way the dev server loads them. */
const project = async (name: string, ...others: string[]): Promise<[Files, string]> => {
  const root = new URL("../../../examples/", import.meta.url).pathname;
  const entry = root + name + "/index.tsx";
  const loaded = { [entry]: await Bun.file(entry).text() };

  for (const other of others) loaded[root + other] = await Bun.file(root + other).text();

  return [loaded, entry];
};

const SCENE = `import { Group, Shape, ease, param, rect, scene, span, track } from "svjeez";

const SIZE = 1000;
const STAGGER = 0.25;
const DUR = 1.5;
const OFFSET = -12;
const INK = "#C39A52";
const soft = "#abc";
const TITLE = 'Hello';
const LOOP = true;
const CURVE = ease.out;
const ORIGIN = [761, 474];
const swing = span(0, 2);

export const params = {
  speed: param.number(1, { min: 0, max: 4, step: 0.5 }),
  shade: param.color("#ff0000"),
  mode: param.choice("a", ["a", "b"]),
};

export default scene({ size: [SIZE, SIZE], duration: 4 }, () => (
  <Group id="all">
    <Shape id="box" geometry={rect(40, 30)} fill="#FF0000" opacity={0.5} />
    <Shape geometry={rect(1, 1)} draw={track(0).to(1, span(0.2, 1.2))} />
  </Group>
));
`;

const files: Files = { "scene.tsx": SCENE };

const signals = discover(files, "scene.tsx");

const at = (key: string): Signal => {
  const signal = signals[key];

  if (!signal) throw new Error("no signal " + key);

  return signal;
};

const must = (found: Signals, key: string): Signal => {
  const signal = found[key];

  if (!signal) throw new Error("no signal " + key);

  return signal;
};

const ofKind = (found: Signals, kind: SignalKind): Signal => {
  const signal = Object.values(found).find((each) => each.kind === kind);

  if (!signal) throw new Error("no " + kind + " signal");

  return signal;
};

/** The file after writing one value. */
const written = (signal: Signal, value: SignalValue, source: Files = files) =>
  Effect.runPromise(
    write(signal, value).pipe(Effect.flatMap((splices) => applySplices(source, splices))),
  ).then((out) => out[signal.file] ?? "");

describe("discover", () => {
  test("finds top-level constants first, then params, spans and props, in source order", () => {
    const named = Object.values(signals).filter((signal) => signal.prominence === "named");

    expect(named.map((signal) => signal.key)).toEqual([
      "SIZE",
      "STAGGER",
      "DUR",
      "OFFSET",
      "INK",
      "soft",
      "TITLE",
      "LOOP",
      "CURVE",
      "ORIGIN",
      "ORIGIN[0]",
      "ORIGIN[1]",
      "speed",
      "shade",
      "mode",
      "swing",
      "box.fill",
      "box.opacity",
    ]);
  });

  test("reads each literal as its kind, with its site and line", () => {
    expect(at("SIZE")).toMatchObject({ kind: "number", value: 1000, origin: "const", line: 3 });
    expect(at("SIZE").sites).toEqual([
      {
        file: "scene.tsx",
        from: SCENE.indexOf("1000"),
        to: SCENE.indexOf("1000") + 4,
        text: "1000",
      },
    ]);
    expect(at("OFFSET")).toMatchObject({ kind: "number", value: -12 });
    expect(at("OFFSET").sites[0]?.text).toBe("-12");
    expect(at("INK")).toMatchObject({ kind: "color", value: "#C39A52" });
    expect(at("TITLE")).toMatchObject({ kind: "text", value: "Hello" });
    expect(at("LOOP")).toMatchObject({ kind: "boolean", value: true });
    expect(at("CURVE")).toMatchObject({ kind: "ease", value: "ease.out" });
    expect(at("ORIGIN[1]")).toMatchObject({ kind: "number", value: 474 });
    expect(at("swing")).toMatchObject({ kind: "span", value: { start: 0, over: 2 } });
    expect(at("span@24")).toMatchObject({
      kind: "span",
      value: { start: 0.2, over: 1.2 },
      line: 24,
    });
    expect(at("box.fill")).toMatchObject({ kind: "color", value: "#FF0000", origin: "prop" });
    expect(at("box.opacity")).toMatchObject({ kind: "number", value: 0.5, origin: "prop" });
  });

  test("takes a param's declared range, and its choices", () => {
    expect(at("speed")).toMatchObject({ origin: "param", range: { min: 0, max: 4, step: 0.5 } });
    expect(at("shade")).toMatchObject({ kind: "color", value: "#ff0000" });
    expect(at("mode")).toMatchObject({ kind: "text", options: ["a", "b"] });
  });

  test("guesses a range from how a number is written", () => {
    expect(guessRange(60)).toEqual({ min: 0, max: 120, step: 1 });
    expect(guessRange(0.25, "0.25")).toEqual({ min: 0, max: 0.5, step: 0.01 });
    expect(guessRange(-12)).toEqual({ min: -24, max: 0, step: 1 });
    expect(guessRange(4.5, "4.5")).toEqual({ min: 0, max: 9, step: 0.01 });
    expect(guessRange(0)).toEqual({ min: -10, max: 10, step: 1 });
  });

  test("reads the escapement's constants: timing, palette, a point and a curve", async () => {
    const found = discover(await example("escapement"), "escapement.tsx");

    expect(found["D"]).toMatchObject({ kind: "number", value: 60 });
    expect(found["BEATS"]).toMatchObject({ kind: "number", value: 30 });
    expect(found["BRASS"]).toMatchObject({ kind: "color", value: "#C39A52" });
    expect(found["ESCAPE[0]"]).toMatchObject({ kind: "number", value: 761 });
    expect(found["sine"]).toMatchObject({ kind: "ease", value: "ease.bezier(0.37, 0, 0.63, 1)" });
    expect(
      Object.values(found).filter((s) => s.kind === "color" && s.origin === "const"),
    ).toHaveLength(10);
  });

  test("reads the epicycles' sizes and its one literal span", async () => {
    const found = discover(await example("epicycles"), "epicycles.tsx");

    expect(found["TERMS"]).toMatchObject({ kind: "number", value: 80 });
    expect(found["SIZE[0]"]).toMatchObject({ value: 960 });
    expect(found["drawing"]).toMatchObject({ kind: "span", value: { start: 0.8, over: 10 } });
  });
});

describe("write", () => {
  test("rewrites one literal and nothing else", async () => {
    const after = await written(at("SIZE"), 1200);

    expect(after).toBe(SCENE.replace("const SIZE = 1000;", "const SIZE = 1200;"));
  });

  test("keeps the decimals, the hex case and the quotes it found", async () => {
    expect(await written(at("STAGGER"), 0.3)).toContain("const STAGGER = 0.3;");
    expect(await written(at("STAGGER"), 1 / 3)).toContain("const STAGGER = 0.33;");
    expect(await written(at("OFFSET"), 8)).toContain("const OFFSET = 8;");
    expect(await written(at("INK"), "#a1b2c3")).toContain('const INK = "#A1B2C3";');
    expect(await written(at("soft"), "#A1B2C3")).toContain('const soft = "#a1b2c3";');
    expect(await written(at("TITLE"), "it's")).toContain("const TITLE = 'it\\'s';");
    expect(await written(at("CURVE"), "ease.inOut")).toContain("const CURVE = ease.inOut;");
    expect(await written(at("box.fill"), "#00ff00")).toContain('fill="#00FF00"');
    expect(await written(at("box.opacity"), 0.75)).toContain("opacity={0.75}");
  });

  test("moves both numbers of a span", async () => {
    expect(await written(at("span@24"), { start: 0.5, over: 2 })).toContain("span(0.5, 2)");
  });

  test("round-trips: what it writes, discover reads back", async () => {
    const cases: [string, SignalValue, SignalValue][] = [
      ["DUR", 2.25, 2.25],
      ["INK", "#112233", "#112233"],
      ["soft", "#AABBCC", "#aabbcc"],
      ["LOOP", false, false],
      ["ORIGIN[0]", 800, 800],
      ["speed", 2.5, 2.5],
      ["swing", { start: 1, over: 3 }, { start: 1, over: 3 }],
    ];

    for (const [key, value, read] of cases) {
      const after = await written(at(key), value);

      expect(discover({ "scene.tsx": after }, "scene.tsx")[key]?.value).toEqual(read);
    }
  });

  test("refuses a value of the wrong kind, and a splice planned against other text", async () => {
    expect(Effect.runPromise(write(at("SIZE"), "big"))).rejects.toBeInstanceOf(InvalidValue);
    expect(Effect.runPromise(write(at("INK"), "red"))).rejects.toBeInstanceOf(InvalidValue);

    const splices = await Effect.runPromise(write(at("SIZE"), 5));

    expect(
      Effect.runPromise(applySplices({ "scene.tsx": SCENE.replace("1000", "2000") }, splices)),
    ).rejects.toBeInstanceOf(StaleSource);
  });
});

describe("derive and pad", () => {
  const values = valuesOf(signals);

  const total = derive([signals["STAGGER"], signals["DUR"]], {
    kind: "number",
    label: "total time",
    get: ([stagger, dur]) => Number(stagger) * 4 + Number(dur),
    set: (next, [stagger, dur]) => {
      const scale = next / (Number(stagger) * 4 + Number(dur));

      return [Number(stagger) * scale, Number(dur) * scale];
    },
  });

  test("a derived control reads several signals and writes them back together", async () => {
    expect(valueOf(total, values)).toBe(2.5);

    const updates = assign(total, 5, values);

    expect(updates).toEqual({ STAGGER: 0.5, DUR: 3 });

    const splices = await Effect.runPromise(writeAll(signals, updates));
    const after = await Effect.runPromise(applySplices(files, splices));

    expect(after["scene.tsx"]).toContain("const STAGGER = 0.5;");
    expect(after["scene.tsx"]).toContain("const DUR = 3;");
  });

  test("a pad drags two number controls as one point", () => {
    const point = pad(signals["ORIGIN[0]"], signals["ORIGIN[1]"], "escape");

    expect(valueOf(point, values)).toEqual([761, 474]);
    expect(assign(point, [10, 20], values)).toEqual({ "ORIGIN[0]": 10, "ORIGIN[1]": 20 });
    expect(view("escape", point, signals, values)).toMatchObject({
      kind: "pad",
      label: "escape",
      from: ["ORIGIN[0]", "ORIGIN[1]"],
      x: { value: 761 },
      y: { value: 474 },
    });
  });

  test("a pad can be made of derived controls", () => {
    const point = pad(total, signals["SIZE"]);

    expect(assign(point, [5, 10], values)).toEqual({ STAGGER: 0.5, DUR: 3, SIZE: 10 });
  });

  test("a derive of a signal that is gone says which", () => {
    expect(() =>
      derive([signals["NOPE"]], { kind: "number", label: "gone", get: () => 0, set: () => [] }),
    ).toThrow("signal 1 is undefined");
  });
});

describe("every literal", () => {
  test("a literal nobody named is a deep signal, keyed by where it is written", () => {
    const rect = at("Shape.rect[0]@24:27");

    expect(rect).toMatchObject({
      kind: "number",
      value: 1,
      origin: "literal",
      prominence: "deep",
      label: "rect width",
      line: 24,
    });
    expect(rect.sites[0]?.text).toBe("1");
    expect(at("scene[0].duration@21:54")).toMatchObject({ value: 4, prominence: "deep" });
  });

  test("never claims a site twice", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");

    for (const [name, found] of [
      ["scene", signals],
      ["derived", discover(derived, entry)],
    ] as const) {
      const claimed = new Map<string, string>();

      for (const signal of Object.values(found))
        if (signal.prominence === "deep" && signal.origin === "literal")
          for (const site of signal.sites) {
            const id = site.file + ":" + site.from;

            expect(claimed.get(id) ?? name + ":" + signal.key).toBe(name + ":" + signal.key);
            claimed.set(id, signal.key);
          }

      const named = Object.values(found).flatMap((signal) =>
        signal.prominence === "named"
          ? signal.sites.map((site) => site.file + ":" + site.from)
          : [],
      );

      expect(named.filter((id) => claimed.has(id))).toEqual([]);
    }
  });

  test("a negative number is one literal with its sign, and a hex color in a prop is one too", () => {
    const found = discover(
      {
        "a.tsx":
          'const f = () => [offset(-3.5), 0x1f]; const g = <Group><Shape id="x" fill="#abc" /><Shape stroke="#AABBCCDD" opacity={0.2} /></Group>;',
      },
      "a.tsx",
    );

    const deep = Object.values(found).filter((signal) => signal.prominence === "deep");

    expect(deep.map((signal) => [signal.kind, signal.value])).toEqual([
      ["number", -3.5],
      ["number", 31],
      ["color", "#AABBCCDD"],
      ["number", 0.2],
    ]);
    expect(found["x.fill"]).toMatchObject({ prominence: "named", origin: "prop" });
  });

  test("skips bit twiddling, indexes and types", () => {
    const found = discover(
      {
        "a.ts": [
          "type Pair = [number, 5];",
          "let a = 0;",
          "a = (a + 0x6d2b79f5) | 0;",
          "a = (a >>> 15) ^ (a << 3);",
          "a |= 8;",
          "const t = [1, 2, 3, 4, 5, 6, 7, 8, 9][4 + 1];",
          "const x = a as 7;",
        ].join("\n"),
      },
      "a.ts",
    );

    expect(Object.values(found).map((signal) => signal.value)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8, 9,
    ]);
  });

  test("reads every ease.x and ease.bezier anywhere in the entry", () => {
    const found = discover(
      { "a.ts": "const f = () => [ease.out, ease.bezier(0.2, 0, 0.8, 1), ease.spring(1)];" },
      "a.ts",
    );

    expect(Object.values(found).map((signal) => [signal.kind, signal.value])).toEqual([
      ["ease", "ease.out"],
      ["ease", "ease.bezier(0.2, 0, 0.8, 1)"],
      ["number", 1],
    ]);
  });

  test("a literal pair in a prop or an argument is a point, with the x site first", async () => {
    const found = discover(
      {
        "a.tsx":
          "const s = <Shape at={[290, 262]} geometry={line([0, 0], [R, 0])} offset={[x, 4]} />;",
      },
      "a.tsx",
    );

    expect(found["Shape.at@1:22"]).toMatchObject({
      kind: "vec",
      value: [290, 262],
      origin: "literal",
      prominence: "deep",
    });
    expect(found["Shape.at@1:22"]?.sites.map((site) => site.text)).toEqual(["290", "262"]);
    expect(
      Object.values(found)
        .filter((signal) => signal.kind === "vec")
        .map((signal) => [signal.key.split("@")[0], signal.value]),
    ).toEqual([
      ["Shape.at", [290, 262]],
      ["Shape.line[0]", [0, 0]],
    ]);

    const after = await written(must(found, "Shape.at@1:22"), [10, 20], {
      "a.tsx": "const s = <Shape at={[290, 262]} />;",
    });

    expect(after).toBe("const s = <Shape at={[10, 20]} />;");
  });
});

describe("object and array consts", () => {
  test("derived's WAVE is a signal per field, named, with every place that reads it", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const found = discover(derived, entry);

    expect(found["WAVE.x"]).toMatchObject({
      kind: "number",
      value: 290,
      origin: "field",
      prominence: "named",
    });
    expect(found["WAVE.width"]?.value).toBe(300);
    expect(found["WAVE.width"]?.uses?.map((site) => site.text)).toEqual(
      Array(5).fill("WAVE.width"),
    );
    expect(found["WAVE.x"]?.uses).toHaveLength(7);
    expect(found["RADIUS"]?.uses?.every((site) => site.text === "RADIUS")).toBe(true);
    expect(found["WAVE.x"]?.sites[0]?.from).toBe(derived[entry]?.indexOf("290"));
  });

  test("a pair const is a point and its two numbers, over the same sites", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const found = discover(derived, entry);
    const center = found["CENTER"];

    expect(center).toMatchObject({ kind: "vec", value: [140, 150], origin: "const" });
    expect(center?.sites.map((site) => site.from)).toEqual([
      found["CENTER[0]"]?.sites[0]?.from ?? -1,
      found["CENTER[1]"]?.sites[0]?.from ?? -1,
    ]);
    expect(found["CENTER[0]"]).toMatchObject({ kind: "number", value: 140 });
    expect(found["CENTER[0]"]?.uses).toHaveLength(1);
  });

  test("nested objects go one level, lists of more than two are NAME[i]", () => {
    const found = discover(
      {
        "a.ts": [
          'export const CFG = { a: 1, deep: { b: 2, c: { d: 3 } }, hue: "#abcdef", at: [4, 5] } as const;',
          'const PALETTE = ["#111111", "#222222", "#333333", "#444444", "#555555"];',
          "const BOX = [[0, 0], [10, 20]];",
        ].join("\n"),
      },
      "a.ts",
    );

    expect(Object.keys(found)).toEqual([
      "CFG.a",
      "CFG.deep.b",
      "CFG.hue",
      "CFG.at",
      "PALETTE[0]",
      "PALETTE[1]",
      "PALETTE[2]",
      "PALETTE[3]",
      "PALETTE[4]",
      "BOX[0]",
      "BOX[1]",
      "CFG.deep.c.d@1:50",
    ]);
    expect(found["PALETTE[3]"]).toMatchObject({ kind: "color", origin: "field", value: "#444444" });
    expect(found["BOX[1]"]).toMatchObject({ kind: "vec", value: [10, 20] });
  });

  test("writing a field changes only its literal", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const found = discover(derived, entry);

    const after = await Effect.runPromise(
      write(must(found, "WAVE.width"), 320).pipe(
        Effect.flatMap((splices) => applySplices(derived, splices)),
      ),
    );

    expect(after[entry]).toBe((derived[entry] ?? "").replace("width: 300", "width: 320"));
  });
});

describe("across files", () => {
  test("theme.blue is in colors.ts, found through theme.ts's re-export, with its uses", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const found = discover(derived, entry);
    const colors = Object.keys(derived).find((name) => name.endsWith("/colors.ts")) ?? "";
    const blue = found["theme.blue"];

    expect(blue).toMatchObject({
      kind: "color",
      value: "#0A6CFF",
      origin: "field",
      prominence: "named",
      file: colors,
    });
    expect(blue?.sites[0]?.file).toBe(colors);
    expect(blue?.uses).toHaveLength(1);
    expect(blue?.uses?.[0]).toMatchObject({ file: entry, text: "theme.blue" });
    expect(found["theme.dark.blue"]).toMatchObject({ value: "#5EA0FF", file: colors });
  });

  test("a write to it lands in colors.ts and leaves the scene alone", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const blue = must(discover(derived, entry), "theme.blue");

    const after = await Effect.runPromise(
      write(blue, "#112233").pipe(Effect.flatMap((splices) => applySplices(derived, splices))),
    );

    expect(after[entry]).toBe(derived[entry]);
    expect(after[blue.file]).toBe(
      (derived[blue.file] ?? "").replace('blue: "#0A6CFF"', 'blue: "#112233"'),
    );
  });

  test("an import that is not loaded makes nothing", async () => {
    const [derived, entry] = await project("derived");

    expect(Object.keys(discover(derived, entry)).some((key) => key.startsWith("theme."))).toBe(
      false,
    );
  });
});

describe("motion chains", () => {
  test("each step of a track is a span with its target and curve", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const found = discover(derived, entry);
    const text = derived[entry] ?? "";

    expect(found["theta.step0"]).toMatchObject({
      kind: "span",
      origin: "chain",
      prominence: "named",
      value: { start: 0.3, over: 2.6 },
      step: { index: 0, chain: "theta" },
    });
    expect(found["theta.step0"]?.sites.map((site) => site.text)).toEqual(["0.3", "2.6"]);
    expect(found["theta.step0"]?.step?.target?.text).toBe("360");
    expect(found["theta.step0"]?.step?.target?.from).toBe(text.indexOf("360"));
    expect(found["theta.step0"]?.step?.ease?.text).toBe("ease.inOut");
    expect(found["theta.step1"]).toMatchObject({
      kind: "number",
      value: 1.2,
      step: { index: 1, chain: "theta" },
    });
    expect(found["theta.step1"]?.step?.ease?.text).toBe("ease.inOut");
  });

  test("the pieces of a step are edited at their own sites", async () => {
    const [derived, entry] = await project("derived", "theme.ts", "colors.ts");
    const step = must(discover(derived, entry), "theta.step0");

    const after = await Effect.runPromise(
      write(step, { start: 0.5, over: 3 }).pipe(
        Effect.flatMap((splices) => applySplices(derived, splices)),
      ),
    );

    expect(after[entry]).toContain("to(360, span(0.5, 3), ease.inOut)");
  });

  test("a step with a time that is not a literal makes no chain signal, and its literals stay deep", () => {
    const found = discover(
      {
        "a.ts": "const t = track(0).to(5, span(delay, 1), ease.out).to(7, span(2, 1));",
      },
      "a.ts",
    );

    expect(Object.keys(found).filter((key) => found[key]?.origin === "chain")).toEqual(["t.step1"]);
    expect(found["t.step1"]?.step?.target?.text).toBe("7");
    expect(
      Object.values(found)
        .filter((s) => s.prominence === "deep")
        .map((s) => s.value),
    ).toEqual([{ start: 2, over: 1 }, 0, 5, 1, "ease.out"]);
  });

  test("keyframes make a signal per frame time", () => {
    const found = discover(
      { "a.ts": "const k = keyframes([[0, 0], [0.4, -30, ease.out], [1, 0]]);" },
      "a.ts",
    );

    expect(found["k.frame1"]).toMatchObject({
      kind: "number",
      value: 0.4,
      origin: "chain",
      step: { index: 1, chain: "k" },
    });
    expect(found["k.frame1"]?.step?.target?.text).toBe("-30");
    expect(found["k.frame1"]?.step?.ease?.text).toBe("ease.out");
  });
});

describe("real scenes", () => {
  test("jellyfish: a factor inside bellGeometry, and the hex strings of its palettes", async () => {
    const [jelly, entry] = await project("jellyfish");
    const found = discover(jelly, entry);

    const bell = Object.values(found).find(
      (signal) => signal.value === 0.16 && signal.key.startsWith("bellGeometry@"),
    );

    expect(bell).toMatchObject({
      prominence: "deep",
      origin: "literal",
      label: "0.16 in bellGeometry",
    });
    expect(found["HERO_PALETTE.outerTop"]).toMatchObject({ kind: "color", value: "#7CF7FF" });
    expect(Object.values(found).some((s) => s.origin === "literal" && s.kind === "color")).toBe(
      true,
    );
    expect(
      Object.values(found).some((s) => s.sites.some((site) => site.text.startsWith("0x"))),
    ).toBe(false);
  });

  test("escapement: the arguments of driven(escapePinion, 32, 110)", async () => {
    const found = discover(await example("escapement"), "escapement.tsx");
    const keys = Object.keys(found).filter((key) => key.startsWith("fourth.driven"));

    expect(keys.map((key) => found[key]?.value)).toEqual([32, 110]);
    expect(found[keys[0] ?? ""]).toMatchObject({ prominence: "deep", label: "driven argument 2" });
  });

  test("discovery of a 900-line scene takes well under 50 ms", async () => {
    const [jelly, entry] = await project("jellyfish");

    discover(jelly, entry);
    const started = performance.now();

    for (let i = 0; i < 5; i++) discover(jelly, entry);

    expect((performance.now() - started) / 5).toBeLessThan(50);
  });
});

describe("extract", () => {
  const run = (source: Files, signal: Signal, name: string) =>
    Effect.runPromise(
      extract(source, signal, name).pipe(
        Effect.flatMap((splices) => applySplices(source, splices)),
      ),
    );

  test("a literal becomes a constant after the imports", async () => {
    const circle = at("Shape.rect[0]@23:36");
    const after = await run(files, circle, "BOX_WIDTH");
    const text = after["scene.tsx"] ?? "";

    expect(text).toContain('} from "svjeez";\n\nconst BOX_WIDTH = 40;\n\nconst SIZE = 1000;');
    expect(text).toContain("geometry={rect(BOX_WIDTH, 30)}");
    expect(discover(after, "scene.tsx")["BOX_WIDTH"]).toMatchObject({ value: 40, origin: "const" });
  });

  test("a point, a color in a prop and a span are taken whole", async () => {
    const source: Files = {
      "a.tsx":
        'import { span } from "svjeez";\nconst s = <Shape at={[290, 262]} fill="#abc" draw={span(1, 2)} />;\n',
    };

    const found = discover(source, "a.tsx");
    const vec = ofKind(found, "vec");
    const color = ofKind(found, "color");
    const call = ofKind(found, "span");

    expect((await run(source, vec, "origin"))["a.tsx"]).toContain(
      "const origin = [290, 262];\n\nconst s = <Shape at={origin}",
    );
    expect((await run(source, color, "TINT"))["a.tsx"]).toContain("fill={TINT}");
    expect((await run(source, color, "TINT"))["a.tsx"]).toContain('const TINT = "#abc";');
    expect((await run(source, call, "LONG"))["a.tsx"]).toContain("draw={LONG}");
    expect((await run(source, call, "LONG"))["a.tsx"]).toContain("const LONG = span(1, 2);");
  });

  test("a file with no imports gets it before its first statement", async () => {
    const source: Files = { "a.ts": "export const f = () => 5;\n" };
    const found = discover(source, "a.ts");
    const after = await run(source, must(found, Object.keys(found)[0] ?? ""), "FIVE");

    expect(after["a.ts"]).toBe("const FIVE = 5;\n\nexport const f = () => FIVE;\n");
  });

  test("refuses a name that is taken, badly written, or a signal that is already named", async () => {
    const circle = at("Shape.rect[0]@23:36");

    for (const name of ["SIZE", "box", "bad name", "1ST", "class", "Mixed_Case", "Shape"])
      if (name !== "box")
        expect(Effect.runPromise(extract(files, circle, name))).rejects.toBeInstanceOf(
          InvalidValue,
        );
    expect(Effect.runPromise(extract(files, at("SIZE"), "BIG"))).rejects.toBeInstanceOf(
      InvalidValue,
    );
    expect(Effect.runPromise(extract(files, at("swing"), "BIG"))).rejects.toBeInstanceOf(
      InvalidValue,
    );
    expect(Effect.runPromise(extract(files, circle, "box"))).resolves.toHaveLength(2);
  });
});
