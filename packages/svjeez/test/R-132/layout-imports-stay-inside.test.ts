import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

test("src/layout imports nothing outside src/layout", () => {
  const dir = join(import.meta.dir, "../../src/layout");

  for (const file of readdirSync(dir)) {
    const imports = [...readFileSync(join(dir, file), "utf8").matchAll(/from\s+"([^"]+)"/g)].map(
      (m) => m[1]!,
    );

    for (const path of imports) expect(`${file}: ${path}`).toMatch(/: \.\/[\w-]+$/);
  }
});
