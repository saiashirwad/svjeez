import { expect, test } from "bun:test";
import * as legacy from "svjeez/extras";
import * as palettes from "../src/palettes.ts";
import * as code from "../src/index.ts";

const slots = Array.from({ length: 16 }, (_, i) => `base0${i.toString(16).toUpperCase()}`);

test("every palette fills all sixteen slots", () => {
  expect(Object.keys(palettes).toSorted()).toEqual([
    "gruvboxDark",
    "gruvboxLight",
    "solarizedDark",
    "solarizedLight",
    "tomorrow",
    "tomorrowNight",
  ]);

  for (const palette of Object.values(palettes))
    expect(Object.keys(palette).toSorted()).toEqual(slots.toSorted());
});

test("the package root carries them too", () => {
  expect(code.tomorrowNight).toBe(palettes.tomorrowNight);
});

// svjeez/extras keeps its own copy for one release; the two must not drift.
test("svjeez/extras has the same colors", () => {
  const old = new Map<string, unknown>(Object.entries(legacy));

  for (const [name, palette] of Object.entries(palettes)) expect(old.get(name)).toEqual(palette);
});
