import { expect, test } from "bun:test";
import * as legacy from "svjeez/extras";
import * as root from "svjeez";

const palettes = [
  "tomorrow",
  "tomorrowNight",
  "solarizedDark",
  "solarizedLight",
  "gruvboxDark",
  "gruvboxLight",
];

// svjeez/extras stays for one release as a deprecated way to reach what moved to the root.
test("svjeez/extras hands out the same values as svjeez", () => {
  const shared = Object.keys(legacy).filter((name) => name in root);

  expect(shared).toContain("timeline");
  expect(shared).toContain("readout");
  expect(shared).toContain("terminal");

  for (const name of shared) expect(Reflect.get(legacy, name)).toBe(Reflect.get(root, name));
});

test("svjeez/extras still has the editor palettes and the kits", () => {
  for (const name of [...palettes, "flowchart", "sequence", "lanes", "tree", "stateMachine"])
    expect(legacy).toHaveProperty(name);

  for (const name of ["axes", "contours", "vectorField"]) expect(legacy).toHaveProperty(name);
});

test("the root has what moved out of svjeez/extras", () => {
  for (const name of ["code", "Camera", "Focus", "appWindow", "flow", "readout", "beats"])
    expect(root).toHaveProperty(name);

  for (const name of palettes) expect(root).not.toHaveProperty(name);
});
