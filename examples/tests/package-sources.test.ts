import { expect, test } from "bun:test";
import { Glob } from "bun";
import { join } from "node:path";

const packages = join(import.meta.dir, "../../packages");

const sources = [...new Glob("*/src/**/*.{ts,tsx}").scanSync(packages)].filter(
  (file) => !file.startsWith("svjeez/"),
);

test("package sources build scene nodes with JSX, not jsx calls", async () => {
  const offenders: string[] = [];

  for (const file of sources) {
    const text = await Bun.file(join(packages, file)).text();

    if (/from\s+["']svjeez\/jsx(-dev)?-runtime["']/.test(text)) offenders.push(file);
  }

  expect(offenders).toEqual([]);
});

test("every package .tsx source carries the jsxImportSource pragma", async () => {
  const missing: string[] = [];

  for (const file of sources.filter((name) => name.endsWith(".tsx"))) {
    const text = await Bun.file(join(packages, file)).text();

    if (!text.startsWith("/** @jsxImportSource svjeez */\n")) missing.push(file);
  }

  expect(missing).toEqual([]);
});

test("package sources and tests build nodes with JSX, not component calls", async () => {
  const offenders: string[] = [];

  const call =
    /(?<![.\w<]|function\s)(Group|Shape|Text|Run|Picture|Sequence|Arrow|Stack|Grid|Center|Align|Node|Edge|Chip|Icon)\(\s*[{a-z]/;

  const files = [...new Glob("*/{src,test}/**/*.{ts,tsx}").scanSync(packages)].filter(
    (file) => !file.startsWith("svjeez/") && !file.includes("/consumer/"),
  );

  for (const file of files) {
    const text = await Bun.file(join(packages, file)).text();

    if (call.test(text)) offenders.push(file);
  }

  expect(offenders).toEqual([]);
});
