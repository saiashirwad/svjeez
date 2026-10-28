import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Every scene that shows code, a code explainer or a terminal takes its palette and mono font from examples/style.ts.
const EXAMPLES = join(import.meta.dir, "../examples");

// Scenes that only label things in a monospace face, with no code on screen, keep their own look.
const OWN_LOOK = [
  "bloom",
  "daynight",
  "effects",
  "fonts",
  "horizon",
  "images",
  "lighthouse",
  "manifold",
  "neon",
  "tictactoe",
];

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

// SAFETY: without withFileTypes, readdirSync returns each entry's relative path as a string.
const scenes = (readdirSync(EXAMPLES, { recursive: true }) as string[]).filter(
  (file) => /\.tsx?$/.test(file) && file !== "style.ts" && !OWN_LOOK.includes(file.split("/")[0]!),
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
