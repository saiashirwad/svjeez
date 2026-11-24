import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dir, "..");

const tracked = new TextDecoder()
  .decode(Bun.spawnSync(["git", "ls-files"], { cwd: root }).stdout)
  .split("\n")
  .filter((file) => file !== "");

test("font files live only in fixtures/fonts, for tests to load through fontFixture()", () => {
  const strays = tracked.filter(
    (file) => /\.(ttf|otf|ttc|woff2?)$/i.test(file) && !file.startsWith("fixtures/fonts/"),
  );

  expect(strays).toEqual([]);
});

test("scene code loads fonts by name from @svjeez/fonts, or from a pinned https URL where it runs in a browser", () => {
  const scenes = tracked.filter(
    (file) =>
      /^(examples|templates|site\/src|packages\/svjeez\/skills)\//.test(file) &&
      /\.(tsx?|jsx?|mjs|css)$/.test(file),
  );

  const local = scenes.flatMap((file) =>
    [
      ...readFileSync(join(root, file), "utf8").matchAll(
        /font\.load\((?!\s*["'`]https:\/\/)([^)]{0,80})|url\((?!\s*["']?https:\/\/)(["']?[^)]*\.(?:ttf|otf|woff2?)["']?)\)/g,
      ),
    ].map((match) => `${file}: ${match[0]}`),
  );

  expect(local).toEqual([]);
});
