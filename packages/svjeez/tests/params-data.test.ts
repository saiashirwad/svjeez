import { describe, expect, test } from "bun:test";
import { param, ease } from "svjeez";
import { defaults, parse, type Json, type Values } from "svjeez/tools";

const params = {
  version: param.text("1.0.0", { maxLength: 12 }),
  accent: param.color("#5EA0FF"),
  rise: param.easing(ease.out),
  tone: param.choice("calm", ["calm", "loud"]),
  rows: param.count(3, { min: 1, max: 6 }),
  tags: param.list(param.text(""), ["fast", "small"], { max: 4 }),
  bars: param.list(
    { label: param.text("Q1", { maxLength: 8 }), value: param.number(4, { min: 0, max: 100 }) },
    [{ label: "Q1", value: 4 }],
    { min: 1 },
  ),
};

describe("data params", () => {
  test("Values infers a text as a string and a list as its items", () => {
    const p: Values<typeof params> = defaults(params);
    const tags: readonly string[] = p.tags;
    const bars: readonly { readonly label: string; readonly value: number }[] = p.bars;
    const tone: "calm" | "loud" = p.tone;

    expect({ tags, bars, tone, version: p.version }).toEqual({
      tags: ["fast", "small"],
      bars: [{ label: "Q1", value: 4 }],
      tone: "calm",
      version: "1.0.0",
    });
  });

  test("a schema with lists is plain data that survives JSON and a structured clone", () => {
    expect(structuredClone(params)).toEqual(params);
    expect(JSON.parse(JSON.stringify(params.bars))).toEqual(params.bars);
  });

  test("a bad declaration throws when the module loads, saying what to fix", () => {
    expect(() => param.text("too long by far", { maxLength: 4 })).toThrow(
      "text() is 15 characters, over its maxLength of 4. Shorten it to fit.",
    );
    expect(() => param.text("a", { maxLength: 0 })).toThrow("needs a whole maxLength of 1 or more");
    expect(() => param.list(param.text(""), ["a", "b", "c"], { max: 2 })).toThrow(
      "list() has 3 items, and needs 0 to 2.",
    );
    expect(() => param.list(param.number(0, { min: 0, max: 1 }), [2])).toThrow(
      "list()[0] needs a number from 0 to 1, got 2.",
    );
    expect(() => param.list(param.text(""), [], { min: 2, max: 1 })).toThrow(
      "list() needs a whole min",
    );
    // @ts-expect-error a list item cannot hold a list
    expect(() => param.list({ inner: param.list(param.text(""), []) }, [])).toThrow(
      'field "inner" cannot be a list',
    );
    // @ts-expect-error a record item needs every field
    expect(() => param.list({ a: param.text("") }, [{}])).not.toThrow();
  });

  test("parse fills what the input leaves out with defaults", () => {
    const p = parse(params, { version: "2.0.0", bars: [{ value: 90 }, { label: "Q2", value: 0 }] });

    expect(p).toEqual({
      ...defaults(params),
      version: "2.0.0",
      bars: [
        { label: "Q1", value: 90 },
        { label: "Q2", value: 0 },
      ],
    });
  });

  test("parse reads a JSON string and an ease by name or as a bezier", () => {
    expect(parse(params, '{ "rise": "pop" }').rise).toBe(ease.pop);
    expect(parse(params, { rise: { kind: "bezier", points: [0.2, 0, 0, 1] } }).rise).toEqual(
      ease.bezier(0.2, 0, 0, 1),
    );
  });

  test("parse names the path of every value it rejects", () => {
    const bad: [Json, string][] = [
      ["{ nope", "The params are not JSON"],
      [[1], "The params need a JSON object keyed by param name, got [1]."],
      [{ colour: "#fff" }, '"colour" is not a param of this scene. It declares version, accent,'],
      [{ version: 2 }, "version needs text, got 2."],
      [{ version: "1.0.0-beta.12" }, "version is 13 characters, over its maxLength of 12."],
      [{ accent: "blue" }, "accent needs #rgb or #rrggbb colors, got blue."],
      [{ rise: "bouncy" }, 'rise needs an ease: "linear", "in", "out", "inOut", "pop", "hold"'],
      [{ tone: "quiet" }, 'tone is one of "calm", "loud", got "quiet".'],
      [{ rows: 7 }, "rows needs a number from 1 to 6, got 7."],
      [{ rows: "3" }, 'rows needs a number from 1 to 6, got "3".'],
      [{ rows: 2.5 }, "rows needs a whole number, got 2.5."],
      [{ tags: "fast" }, 'tags needs a list, got "fast".'],
      [{ tags: ["a", "b", "c", "d", "e"] }, "tags has 5 items, and needs 0 to 4."],
      [{ tags: ["a", 3] }, "tags[1] needs text, got 3."],
      [{ bars: [] }, "bars has 0 items, and needs at least 1."],
      [{ bars: [4] }, "bars[0] needs an object with label, value, got 4."],
      [{ bars: [{ value: 140 }] }, "bars[0].value needs a number from 0 to 100, got 140."],
      [{ bars: [{ name: "Q1" }] }, "bars[0].name is not a field. An item has label, value."],
    ];

    for (const [input, message] of bad) expect(() => parse(params, input)).toThrow(message);
  });
});
