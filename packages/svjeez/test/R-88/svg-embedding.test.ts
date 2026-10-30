import { describe, expect, test } from "bun:test";
import { picture } from "svjeez";

describe("picture", () => {
  test("SVG goes in as percent-encoded text and decodes back to the markup", () => {
    const markup = '<svg viewBox="0 0 10 10"><rect fill="#f00" width="10%" height="10"/></svg>';
    const { href } = picture(markup);
    expect(href.startsWith("data:image/svg+xml,")).toBe(true);
    expect(href).not.toContain("base64");
    expect(href).not.toMatch(/[<>"#]/);
    expect(decodeURIComponent(href.slice("data:image/svg+xml,".length))).toBe(markup);
  });

  test("text, quotes and whitespace inside an SVG survive embedding exactly", () => {
    const markup =
      '<svg viewBox="0 0 10 10"><text xml:space="preserve">a="\t\tb</text>\n<rect fill="#00f" width="1" height="1"/></svg>';

    expect(decodeURIComponent(picture(markup).href.slice("data:image/svg+xml,".length))).toBe(
      markup,
    );
  });

  test("an SVG is only an SVG when the root element is <svg>", () => {
    expect(() =>
      picture('<!doctype html><html><body><svg width="16" height="16"></svg></body></html>'),
    ).toThrow("Unknown image format");
    const prolog = `<?xml version="1.0"?>\n<!-- ${"license ".repeat(2000)} <svg width="1" height="1"> -->\n<!DOCTYPE svg>\n`;
    expect(picture(`${prolog}<svg viewBox="0 0 100 50"/>`)).toMatchObject({
      format: "svg",
      width: 100,
      height: 50,
    });
  });
});
