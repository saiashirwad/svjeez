import { describe, expect, test } from "bun:test";
import { ease } from "svjeez";
import { apply, literalAt, paramLiteral, parse, set, write } from "../../src/source";
import { meadow, numberOf, plane } from "../helpers/live-source";

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
