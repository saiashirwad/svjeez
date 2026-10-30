import { describe, expect, test } from "bun:test";
import { validateSvg } from "svjeez";
import { compileBuild, compileScene } from "../../src/compile";
import { read } from "../helpers/live-compile";

describe("compileScene", () => {
  test("a scene that declares params compiles from its source text with the defaults", async () => {
    const result = await compileScene(read("../../../../site/src/lab/a/meadow.tsx"));

    if (!result.ok) throw new Error(result.error.message);
    expect(validateSvg(result.svg).errors).toEqual([]);
    expect(result.stats).toMatchObject({ scriptBytes: 0 });
    expect(result.stats.keyframes).toBeGreaterThan(0);
    expect(result.stats.gzip).toBeLessThan(result.stats.bytes);
  });

  test("compileBuild measures what a build returns, or reports what it throws", async () => {
    expect(await compileBuild(() => "<svg/>")).toMatchObject({ ok: true, stats: { bytes: 6 } });
    expect(
      await compileBuild(() => {
        throw new Error("nope");
      }),
    ).toMatchObject({ ok: false, error: { kind: "runtime", message: "nope" } });
  });
});

describe("what a scene declares", () => {
  test("a compile reports the scene's size and length, its params, and where each param's handle sits and moves", async () => {
    const result = await compileScene(read("../../../../site/src/lab/live/pendulum.tsx"));

    if (!result.ok) throw new Error(result.error.message);
    expect(result.scene).toMatchObject({ width: 480, height: 320, title: "Pendulum" });
    expect(Object.keys(result.params ?? {})).toEqual(["length", "swing", "bob"]);
    // The length handle sits at the bottom of the arc, 190 below the pivot at (240, 36), and moves straight down.
    expect(result.handles?.length?.at).toEqual({ x: 240, y: 226 });
    expect(result.handles?.length?.way.x).toBeCloseTo(0);
    expect(result.handles?.length?.way.y).toBeCloseTo(1);
  });
});
