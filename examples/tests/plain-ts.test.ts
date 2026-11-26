import { expect, test } from "bun:test";
import { svg } from "svjeez/tools";

const pairs = [
  ["plain-ts/basic.ts", "readme/basic.tsx"],
  ["plain-ts/morph.ts", "morph/index.tsx"],
  ["plain-ts/layout.ts", "layout/index.tsx"],
  ["plain-ts/flowchart.ts", "flowchart/index.tsx"],
  ["plain-ts/count.ts", "count/index.tsx"],
] as const;

for (const [plain, jsx] of pairs)
  test(`${plain} emits the same SVG as ${jsx}`, async () => {
    const [a, b] = await Promise.all([import(`../${plain}`), import(`../${jsx}`)]);

    expect(svg.emit(a.default)).toBe(svg.emit(b.default));
  });
