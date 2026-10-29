import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { ease } from "svjeez";
import { init, update } from "../src/editor.ts";
import {
  apply,
  callsIn,
  linesOf,
  literalAt,
  paramLiteral,
  parse,
  set,
  madeBy,
  write,
  type Literal,
  type LiteralOf,
} from "../src/source";

const meadow = readFileSync(new URL("../../../site/src/lab/a/meadow.tsx", import.meta.url), "utf8");

const plane = `const launch = 0.4;
const legs = [
  { to: [150, -80], over: 1.5 },
  { to: [300, 175], over: 1.2 },
];
export default () => <circle cx={legs[0].to[0]} r={4} fill="#FFFFFF" />;
`;

const numberOf = (literal: Literal | undefined): LiteralOf<"number"> => {
  if (literal?.kind !== "number") throw new Error(`expected a number, got ${literal?.kind}`);

  return literal;
};

const numbers = (text: string) =>
  parse(text).literals.filter((l): l is LiteralOf<"number"> => l.kind === "number");

describe("literals", () => {
  test("each literal has its exact range, its value and where it sits", () => {
    const source = parse(plane);
    const r = source.literals.find((l) => l.role.kind === "attribute" && l.role.name === "r")!;

    expect(plane.slice(...r.range)).toBe("4");
    expect(r).toMatchObject({
      kind: "number",
      value: 4,
      role: { kind: "attribute", name: "r", tag: "circle" },
    });
    expect(source.literals.find((l) => l.kind === "color")).toMatchObject({ value: "#FFFFFF" });
  });

  test("a path leads from a const through objects and arrays", () => {
    const source = parse(plane);

    expect(literalAt(source, ["launch"])).toMatchObject({
      value: 0.4,
      role: { kind: "const", name: "launch" },
    });
    expect(literalAt(source, ["legs", 1, "over"])).toMatchObject({ value: 1.2 });
    expect(literalAt(source, ["legs", 0, "to", 1])).toMatchObject({ text: "-80", value: -80 });
    expect(literalAt(source, ["legs", 0, "to", 1])!.role).toEqual({ kind: "other" });
    expect(
      source.literals.find((l) => l.text === "0" && l.role.kind === "other")?.path,
    ).toBeUndefined();
  });

  test("call arguments know the method and their place", () => {
    const at = numbers("motion({ y: 1 }).at(0.8 + i).to({ y: 0 }, 0.6);").map((l) => l.role);

    expect(at).toEqual([
      { kind: "property", name: "y" },
      { kind: "argument", callee: "at", index: 0 },
      { kind: "property", name: "y" },
      { kind: "argument", callee: "to", index: 1 },
    ]);
  });

  test("an ease is one literal, named or bezier, and its numbers are not numbers of their own", () => {
    const source = parse(
      "const a = ease.bezier(0.2, -0.8, 0.2, 1); const b = ease.pop; const c = ease.hold;",
    );

    expect(source.literals.map((l) => l.kind)).toEqual(["ease", "ease"]);
    expect(source.literals[0]).toMatchObject({
      name: "bezier",
      value: ease.bezier(0.2, -0.8, 0.2, 1),
    });
    expect(source.literals[1]).toMatchObject({ name: "pop", value: ease.pop });
  });

  test("the parser finds each declared param's literal, and its options apart from it", () => {
    const source = parse(meadow);
    const flowers = paramLiteral(source, "flowers")!;

    expect(flowers).toMatchObject({ kind: "number", value: 5, param: { key: "flowers" } });
    expect(paramLiteral(source, "petal")).toMatchObject({ kind: "color", value: "#FF5D8F" });
    expect(paramLiteral(source, "rise")).toMatchObject({ kind: "ease", name: "bezier" });
    expect(
      source.literals
        .filter((l) => l.param?.key === "flowers")
        .map((l) => [l.text, l.param?.option]),
    ).toEqual([
      ["5", undefined],
      ["1", "min"],
      ["12", "max"],
      ['"how many"', "label"],
    ]);
  });
});

describe("edits", () => {
  test("set rewrites one literal and keeps every other byte", () => {
    const source = parse(meadow);
    const next = set(source, { ...numberOf(paramLiteral(source, "flowers")), value: 9 });

    expect(next).toBe(meadow.replace("count(5,", "count(9,"));
    expect(paramLiteral(parse(next), "flowers")).toMatchObject({ value: 9 });
  });

  test("write keeps a number's decimals, a color's quotes and names an ease it can", () => {
    const n = numberOf(parse("const a = 0.25;").literals[0]);
    const [c, e] = parse("const c = '#000000'; const e = ease.in;").literals;

    expect(write({ ...n, value: 0.3 })).toBe("0.3");
    expect(write({ ...n, value: 1 / 3 })).toBe("0.33");
    expect(write({ ...n, value: -0.001 })).toBe("0");
    expect(write({ ...n, value: 1 / 3 }, 6)).toBe("0.333333");
    expect(c?.kind === "color" && write({ ...c, value: "#123ABC" })).toBe("'#123ABC'");
    expect(e?.kind === "ease" && write({ ...e, value: ease.pop })).toBe("ease.pop");
    expect(e?.kind === "ease" && write({ ...e, value: ease.bezier(0.1, 0.123, 1, 1) })).toBe(
      "ease.bezier(0.1, 0.12, 1, 1)",
    );
  });

  test("apply makes several edits against the original ranges", () => {
    const source = parse(plane);
    const a = literalAt(source, ["legs", 0, "over"])!;
    const b = literalAt(source, ["launch"])!;

    expect(
      apply(plane, [
        { range: a.range, text: "12.25" },
        { range: b.range, text: "0" },
      ]),
    ).toBe(plane.replace("0.4", "0").replace("1.5", "12.25"));
  });
});

describe("panel lines", () => {
  test("lines put the text back together, with live literals as pieces of their own", () => {
    const source = parse(meadow);
    const lines = linesOf(source, (l) => l.kind !== "string" && !l.param?.option);

    expect(lines.map((l) => l.pieces.map((p) => p.text).join("")).join("\n")).toBe(meadow);

    const flowers = lines.find((l) =>
      l.pieces
        .map((p) => p.text)
        .join("")
        .includes("flowers: count"),
    )!;

    expect(flowers.pieces.filter((p) => p.kind === "literal").map((p) => p.text)).toEqual(["5"]);
    expect(flowers.pieces.find((p) => p.text === "count")?.kind).toBe("fn");
    expect(lines[0]!.pieces[0]).toMatchObject({ kind: "keyword", text: "import" });
  });
});

describe("linking", () => {
  const source = parse(meadow);
  const at = (needle: string) => meadow.indexOf(needle);
  const tags = (offset: number) => madeBy(source, offset).map((e) => e.tag);

  test("an attribute shapes its own element", () => {
    expect(tags(at("cx={360}"))).toEqual(["circle"]);
  });

  test("a param shapes every element that reads it", () => {
    expect(tags(at("sky: color"))).toEqual(["rect"]);
    expect(tags(at("grass: color"))).toEqual(["path", "path"]);
    expect(tags(at("flowers: count"))).toEqual(["g"]);
  });

  test("a const shapes what its uses shape", () => {
    expect(tags(at("const pulse"))).toEqual(["circle"]);
  });

  test("an element's motion steps follow animation={name} to the const", () => {
    const sun = source.elements.find(
      (e) => e.tag === "circle" && e.attributes.some((a) => a.ref === "sun"),
    )!;

    const steps = callsIn(source, sun, "to").map(([from]) => source.lineAt(from));

    expect(steps.length).toBe(2);
    expect(steps.every((n) => source.text.split("\n")[n - 1]!.includes("const sunrise"))).toBe(
      true,
    );

    const flower = source.elements.find(
      (e) => e.tag === "g" && e.attributes.some((a) => a.name === "animation"),
    )!;

    expect(callsIn(source, flower, "label").length).toBe(1);
    expect(callsIn(source, flower, "to").length).toBe(2);
  });
});

describe("keys", () => {
  const scene = `export const params = { swing: count(3, { min: 1, max: 9 }) };
const legs = [{ over: 1.5 }, { over: 1.2 }];
export default function build() {
  return <rect fill="#3EE6D6" stroke="#181f2e8c" x={30_000} width={4} opacity={0.5} />;
}
`;

  test("a param, a path and an unnamed literal each get a key of their own", () => {
    expect(parse(scene).literals.map((l) => l.key)).toEqual([
      "params.swing",
      "params.swing.min",
      "params.swing.max",
      "legs.0.over",
      "legs.1.over",
      "default#0",
      "default#1",
      "default#2",
      "default#3",
      "default#4",
    ]);
  });

  test("a key stays with its literal when another value changes length", () => {
    const before = parse(scene);
    const x = before.literals.find((l) => l.key === "default#2")!;
    const after = parse(set(before, { ...numberOf(x), value: -12.25 }));

    expect(after.literals.map((l) => l.key)).toEqual(before.literals.map((l) => l.key));
    expect(after.literals.find((l) => l.key === "default#3")).toMatchObject({ value: 4 });
  });

  test("a key survives an edit to another declaration", () => {
    const rewritten = scene.replace("const legs", "const speed = 2;\nconst legs");

    expect(parse(rewritten).literals.find((l) => l.key === "default#3")).toMatchObject({
      value: 4,
    });
  });

  test("consts of one name in two functions are two values, and setting one leaves the other", () => {
    const text = `function a() { const r = 5; return r; }
function b() { const r = 7; return r; }
export default () => a() + b();
`;

    const keys = parse(text).literals.map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);

    const [state] = init({ text, now: 0 });
    const seven = state.values.find((v) => v.literal.text === "7")!;
    const [next] = update(state, { type: "set", key: seven.key, value: 9 });

    expect(next.text).toContain("const r = 5;");
    expect(next.text).toContain("const r = 9;");
  });

  test("every literal gets a key of its own, even where the file names one thing twice", () => {
    const text = `const p = { x: 1, x: 2 };\nconst p = { x: 3 };\n`;
    const keys = parse(text).literals.map((l) => l.key);

    expect(new Set(keys).size).toBe(3);
  });

  test("a literal in an unnamed statement keeps its key when an earlier value changes length", () => {
    const text = `const size = 10;\nconsole.log(3, 4);\nexport default () => size;\n`;
    const keys = (t: string) => parse(t).literals.map((l) => l.key);

    expect(keys(text.replace("10", "1000"))).toEqual(keys(text));
  });

  test("quoted attributes, eight-digit colors and numeric separators read as what they are", () => {
    const [fill, stroke, x] = parse(scene).literals.filter((l) => l.key.startsWith("default"));

    expect(fill).toMatchObject({
      kind: "color",
      value: "#3EE6D6",
      role: { kind: "attribute", name: "fill", tag: "rect" },
    });
    expect(stroke).toMatchObject({ kind: "color", value: "#181f2e8c" });
    expect(x).toMatchObject({ kind: "number", value: 30000 });
  });
});
