import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez";

describe("image validation", () => {
  const wrap = (inner: string) => `<svg viewBox="0 0 10 10">${inner}</svg>`;

  test("a data URI over 256 KB warns with its size", () => {
    const big = `data:image/png;base64,${"A".repeat(300 * 1024)}`;
    const { warnings } = validateSvg(wrap(`<image href="${big}"/>`));
    expect(
      warnings.some((warning) => warning.includes("300 KB") && warning.includes("recompress")),
    ).toBe(true);
    expect(validateSvg(wrap('<image href="data:image/png;base64,AAAA"/>')).warnings).toEqual([]);
  });
});
