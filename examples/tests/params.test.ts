import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateSvg } from "svjeez/frames";
import { defaults, parse, type Schema, type Values } from "svjeez/params";
import { isScene, svg as backend, type Scene } from "svjeez/scene";

// The template scenes render their defaults in the build and the data beside them through --params; both must draw.
const EXAMPLES = join(import.meta.dir, "..");

const svgOf = (made: string | Scene): string => (isScene(made) ? backend.emit(made) : made);

describe("template scenes", () => {
  for (const name of ["release-card", "metrics", "leaderboard"])
    test(`${name} draws its defaults and its data.json`, async () => {
      const scene: { params: Schema; default: (values: Values<Schema>) => string | Scene } =
        await import(join(EXAMPLES, name, "index.tsx"));

      const data = parse(scene.params, readFileSync(join(EXAMPLES, name, "data.json"), "utf8"));

      for (const values of [defaults(scene.params), data])
        expect(validateSvg(svgOf(scene.default(values))).errors).toEqual([]);
    });
});
