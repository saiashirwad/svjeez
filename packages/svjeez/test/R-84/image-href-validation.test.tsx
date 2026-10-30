import { describe, expect, test } from "bun:test";
import { render, validateSvg } from "svjeez";

describe("image validation", () => {
  const wrap = (inner: string) => `<svg viewBox="0 0 10 10">${inner}</svg>`;

  test("an external image href warns and points to picture.load, without failing the render", () => {
    for (const tag of [
      '<image href="photo.png"/>',
      '<image xlink:href="https://x.test/a.png"/>',
      '<feImage href="a.png"/>',
      '<use href="sprite.svg#a"/>',
      "<image href='a.png'/>",
      '<image x="1" href = "a.png"/>',
    ]) {
      const { errors, warnings } = validateSvg(wrap(tag));
      expect(errors).toEqual([]);
      expect(
        warnings.some((warning) => warning.includes("<img>") && warning.includes("picture.load()")),
      ).toBe(true);
    }

    expect(() =>
      render(
        { width: 10, height: 10, duration: 1, title: "x" },
        <image href="photo.png" width={10} height={10} />,
      ),
    ).not.toThrow();
  });

  test("fragment and data hrefs, and links, pass", () => {
    const { errors } = validateSvg(
      wrap(
        '<symbol id="a"/><use href="#a"/><image href="data:image/png;base64,AAAA"/><a href="https://x.test"><rect/></a>',
      ),
    );

    expect(errors).toEqual([]);
  });
});
