import { describe, expect, test } from "bun:test";
import { compileScene } from "../../src/compile";

describe("compileScene", () => {
  test("sources marks each element with the line that made it", async () => {
    const result = await compileScene(
      `import { render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" },\n  <rect width={1} height={1} />);`,
      { sources: true },
    );

    expect(result.ok && result.svg).toContain('data-source="3"');
  });
});
