import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// Every scene that shows code, a code explainer or a terminal takes its palette and mono font from examples/style.ts.
const EXAMPLES = join(import.meta.dir, "..");

// Scenes that only label things in a monospace face, with no code on screen, keep their own look.
const OWN_LOOK = ["effects", "fonts", "horizon", "images", "lighthouse", "neon"];

// Not scenes.
const SKIP = ["dist", "node_modules", "scripts", "tests"];

const RULES: [RegExp, string][] = [
  [
    /\b(tomorrow|tomorrowNight|defaultDark|defaultLight)\b/,
    "a stock code palette: import { theme, css } from examples/style.ts",
  ],
  [/\bbase16\(/, "a hand-made palette: import { theme, css } from examples/style.ts"],
  [
    /ui-monospace|SF ?Mono|Menlo|['"]JetBrains Mono['"]/,
    "a mono font stack, which embeds nothing: pass mono from examples/style.ts as font or fontFamily",
  ],
  [/font\.load\([^)]*JetBrainsMono/, "its own JetBrains Mono: import mono from examples/style.ts"],
];

const scenes = [...new Bun.Glob("**/*.{ts,tsx}").scanSync(EXAMPLES)].filter(
  (file) =>
    file !== "style.ts" &&
    !SKIP.includes(file.split("/")[0]!) &&
    !OWN_LOOK.includes(file.split("/")[0]!),
);

describe("code scenes share examples/style.ts", () => {
  test("no scene brings its own code palette or mono font", () => {
    const found = scenes.flatMap((file) => {
      const source = readFileSync(join(EXAMPLES, file), "utf8");

      return RULES.flatMap(([pattern, problem]) =>
        pattern.test(source) ? [`${file}: ${problem}`] : [],
      );
    });

    expect(found).toEqual([]);
  });
});
