import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import {
  InvalidValue,
  StaleSource,
  applySplices,
  assign,
  derive,
  discover,
  guessRange,
  pad,
  valueOf,
  valuesOf,
  view,
  write,
  writeAll,
} from "../src/index.ts";
import type { Files, Signal, SignalValue } from "../src/index.ts";

const example = (name: string): Promise<Files> => {
  const path = new URL("../../../examples/" + name + "/index.tsx", import.meta.url).pathname;

  return Bun.file(path)
    .text()
    .then((text) => ({ [name + ".tsx"]: text }));
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

/** The file after writing one value. */
const written = (signal: Signal, value: SignalValue, source: Files = files) =>
  Effect.runPromise(
    write(signal, value).pipe(Effect.flatMap((splices) => applySplices(source, splices))),
  ).then((out) => out[signal.file] ?? "");

describe("discover", () => {
  test("finds top-level constants first, then params, spans and props, in source order", () => {
    expect(Object.keys(signals)).toEqual([
      "SIZE",
      "STAGGER",
      "DUR",
      "OFFSET",
      "INK",
      "soft",
      "TITLE",
      "LOOP",
      "CURVE",
      "ORIGIN[0]",
      "ORIGIN[1]",
      "speed",
      "shade",
      "mode",
      "swing",
      "span@24",
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
    expect(Object.values(found).filter((s) => s.kind === "color")).toHaveLength(10);
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
