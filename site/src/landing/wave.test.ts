import { describe, expect, test } from "bun:test";
import { editFor, valueAt, valuesOf } from "@svjeez/live";
import { compileScene } from "@svjeez/live/compile";
import { apply, parse } from "@svjeez/live/source";
import { ease } from "svjeez";
import text from "./wave.tsx?raw";

// The homepage hands this scene to visitors to play with, so no control may reach a value it throws on.
describe("the homepage editor's scene", () => {
  const values = valuesOf(parse(text));

  test("compiles small", async () => {
    const compiled = await compileScene(text);

    if (!compiled.ok) throw new Error(compiled.error.message);
    expect(compiled.stats.gzip).toBeLessThan(2500);
  });

  test("builds at every step of every control's range", async () => {
    const failures: string[] = [];

    for (const value of values) {
      const tries =
        value.kind === "number"
          ? Array.from({ length: 11 }, (_, k) => valueAt(value.param, k / 10))
          : value.kind === "ease"
            ? [ease.linear, ease.in, ease.out, ease.pop, ease.bezier(0.3, 1.8, 0.6, -0.6)]
            : value.kind === "color"
              ? ["#000000", "#FFFFFF"]
              : [];

      for (const v of tries) {
        // SAFETY: each try is of the kind its value edits.
        const edit = editFor(value, v as never);

        if (!edit) continue;
        const compiled = await compileScene(apply(text, [edit]));

        if (!compiled.ok)
          failures.push(`${value.key} = ${JSON.stringify(v)}: ${compiled.error.message}`);
      }
    }

    expect(failures).toEqual([]);
  });
});
