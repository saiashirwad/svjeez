import { describe, expect, test } from "bun:test";
import { BunServices } from "@effect/platform-bun";
import { Effect } from "effect";
import { isCandidate, looksLikeScene, scenesIn } from "../src/scenes.ts";

describe("scenes", () => {
  test("a scene is a module that default-exports and calls scene()", () => {
    expect(looksLikeScene("export default scene({ size: [1, 1] }, () => null);")).toBe(true);
    expect(
      looksLikeScene("export default (values) =>\n  scene({ size: [1, 1] }, () => null);"),
    ).toBe(true);
    expect(looksLikeScene('export const theme = { ink: "#000" };')).toBe(false);
  });

  test("dependencies, build output, dot files and preview copies are never candidates", () => {
    expect(isCandidate("a/index.tsx")).toBe(true);
    expect(isCandidate("node_modules/x/index.tsx")).toBe(false);
    expect(isCandidate("dist/a.ts")).toBe(false);
    expect(isCandidate("a/.index.svjeez-dev-3.tsx")).toBe(false);
    expect(isCandidate("a/types.d.ts")).toBe(false);
  });

  test("finds the examples' scenes by their text", async () => {
    const root = new URL("../../../examples/", import.meta.url).pathname;
    const found = await Effect.runPromise(scenesIn(root).pipe(Effect.provide(BunServices.layer)));

    expect(found).toContain("escapement/index.tsx");
    expect(found).toContain("epicycles/index.tsx");
    expect(found).not.toContain("escapement/mechanism.ts");
    expect(found.some((scene) => scene.includes("node_modules"))).toBe(false);
  });
});
