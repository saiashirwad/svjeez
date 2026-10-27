import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez";

describe("validation", () => {
  test("accepts a minimal valid scene", () => {
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><style>@keyframes x{0%{opacity:0}100%{opacity:1}}.a-x{animation-name:x}.a{animation:x 1s infinite}</style><rect width="10" height="10" fill="url(#p)"/><defs><pattern id="p"/></defs></svg>`;
    const result = validateSvg(source);
    expect(result.errors).toEqual([]);
  });

  test("reports duplicate ids, missing refs and missing keyframes", () => {
    const source = `<svg viewBox="0 0 10 10"><style>@keyframes x{0%{opacity:0}}.a-x{animation-name:y}</style><rect id="a"/><rect id="a" fill="url(#nope)"/></svg>`;
    const result = validateSvg(source);
    expect(result.errors).toContain('Duplicate id "a".');
    expect(result.errors).toContain("url(#nope) has no matching id.");
    expect(result.errors).toContain('Animation "y" has no matching @keyframes.');
  });

  test("warns for unused keyframes and a missing viewBox", () => {
    const source = `<svg><style>@keyframes unused{0%{opacity:0}}</style></svg>`;
    const result = validateSvg(source);
    expect(result.warnings).toContain('The root <svg> has no viewBox.');
    expect(result.warnings).toContain('@keyframes "unused" is never referenced.');
  });

  test("warns when a filter sits over many animated elements, and only then", () => {
    const rings = (count: number) => Array.from({ length: count }, () => '<circle class="a m1" r="5"/>').join("");
    const scene = (count: number) => `<svg viewBox="0 0 10 10"><defs><filter id="f"/></defs><g filter="url(#f)"><g>${rings(count)}</g></g></svg>`;
    expect(validateSvg(scene(60)).warnings.some((warning) => warning.includes("sits over 60 animated elements"))).toBe(true);
    expect(validateSvg(scene(20)).warnings).toEqual([]);
  });
});
