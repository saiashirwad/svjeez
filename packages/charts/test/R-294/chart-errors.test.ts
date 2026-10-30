import { describe, expect, test } from "bun:test";
import { chart } from "../../src/index.ts";

describe("errors name the call, what it got and the fix", () => {
  test("chart()", () => {
    expect(() =>
      chart({ width: 0, height: 10, x: { kind: "band", domain: ["a"] }, data: [["a", 1]] }),
    ).toThrow("chart() needs a positive width and height, got 0 and 10.");
    expect(() => chart({ width: 10, height: 10, x: { kind: "band", domain: ["a"] } })).toThrow(
      "chart() needs y.domain or data to fit the y scale, got neither.",
    );
    expect(() =>
      chart({ width: 10, height: 10, x: { kind: "band", domain: [] }, y: { domain: [0, 1] } }),
    ).toThrow("chart() needs at least one x.domain category, got none.");
    expect(() =>
      chart({
        width: 10,
        height: 10,
        x: { kind: "band", domain: ["a", "a"] },
        y: { domain: [0, 1] },
      }),
    ).toThrow(`chart() needs distinct x.domain categories, got "a" twice.`);
    expect(() =>
      chart({
        width: 10,
        height: 10,
        x: { kind: "linear", domain: [0, 1] },
        data: [[0, Number.NaN]],
      }),
    ).toThrow("chart() needs finite data, got [0, NaN] at index 0.");
    expect(() =>
      chart({ width: 10, height: 10, x: { kind: "linear" }, y: { domain: [0, 1] } }),
    ).toThrow("chart() needs x.domain or data to fit the x scale, got neither.");
  });
});
