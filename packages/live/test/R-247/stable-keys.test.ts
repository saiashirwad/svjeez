import { describe, expect, test } from "bun:test";
import { init, update } from "../../src/editor.ts";
import { parse, set } from "../../src/source";
import { keysScene as scene, numberOf } from "../helpers/live-source";

describe("keys", () => {
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
});
