import { expect, test } from "bun:test";
import { Shape, scene } from "svjeez";
import { svg } from "svjeez/tools";
import * as palettes from "../src/palettes.ts";
import * as root from "../src/index.ts";
import { ROLES, type CodeRole } from "../src/roles.ts";

const { palette, ...ready } = palettes;

test("every palette fills every role with a token that has a light and a dark value", () => {
  expect(Object.keys(ready).toSorted()).toEqual(["gruvbox", "rosePine", "solarized", "tomorrow"]);

  for (const each of Object.values(ready)) {
    expect(Object.keys(each).toSorted()).toEqual([...ROLES].toSorted());

    for (const token of Object.values(each))
      expect(token).toMatchObject({
        kind: "token",
        light: expect.any(String),
        dark: expect.any(String),
      });
  }
});

test("palette() names its tokens after the palette, so they never meet a scene's own", () => {
  const colors = {
    plain: "#123456",
    comment: "#123456",
    punctuation: "#123456",
    keyword: "#123456",
    string: "#123456",
    number: "#123456",
    constant: "#123456",
    variable: "#123456",
    function: "#123456",
    type: "#123456",
    tag: "#123456",
    inserted: "#123456",
    deleted: "#123456",
  } as const satisfies Record<CodeRole, `#${string}`>;

  const mine = palette("mine", { light: colors, dark: colors });

  expect(mine.keyword).toMatchObject({ name: "mine-keyword" });
  expect(mine.plain).toMatchObject({ name: "mine-plain" });

  const out = svg.emit(
    scene({ size: [20, 20], duration: 1, title: "Palette" }, (canvas) => (
      <Shape geometry={canvas.rect} fill={mine.keyword} />
    )),
  );

  expect(out).toContain("--mine-keyword:#123456");
});

test("the package root leaves the palettes to the subpath", () => {
  expect(Object.keys(root).toSorted()).toEqual(["Code", "ROLES", "highlight"]);
});
