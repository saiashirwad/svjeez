import { describe, expect, test } from "bun:test";
import { picture } from "svjeez";
import { bytes } from "../helpers/picture-fixtures";

describe("picture", () => {
  test("an SVG with no size is an error", () => {
    expect(() => picture("<svg><rect/></svg>")).toThrow("no size");
  });

  test("an unknown format names the supported ones", () => {
    expect(() => picture(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))).toThrow(
      /Unknown image format.*png.*jpeg.*gif.*webp.*svg/,
    );
    expect(() => picture("hello")).toThrow("Unknown image format");
  });
});
