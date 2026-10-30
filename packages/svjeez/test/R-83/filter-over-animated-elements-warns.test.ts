import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez";

describe("validation", () => {
  test("warns when a filter sits over many animated elements, and only then", () => {
    const rings = (count: number) =>
      Array.from({ length: count }, () => '<circle class="a m1" r="5"/>').join("");

    const scene = (count: number) =>
      `<svg viewBox="0 0 10 10"><defs><filter id="f"/></defs><g filter="url(#f)"><g>${rings(count)}</g></g></svg>`;

    expect(
      validateSvg(scene(60)).warnings.some((warning) =>
        warning.includes("sits over 60 animated elements"),
      ),
    ).toBe(true);
    expect(validateSvg(scene(20)).warnings).toEqual([]);
  });
});
