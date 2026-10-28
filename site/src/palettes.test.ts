import { expect, test } from "bun:test";
import { palette } from "@examples/style";
import { DEFAULT_PALETTE, PALETTES } from "./palettes";

test("the default palette is the look the example scenes are built with", () => {
  const system = PALETTES.find(({ id }) => id === DEFAULT_PALETTE)!;
  expect({ light: system.light, dark: system.dark }).toEqual(palette);
});
