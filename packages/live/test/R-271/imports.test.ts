import { describe, expect, test } from "bun:test";
import { compileScene } from "../../src/compile";

describe("compileScene", () => {
  test("a scene can import world-atlas's maps", async () => {
    const result = await compileScene(
      `import land from "world-atlas/land-110m.json";\nimport { render } from "svjeez";\nexport default () => render({ width: 10, height: 10, duration: 1, title: "x" }, <text>{land.type}</text>);`,
    );

    expect(result.ok && result.svg).toContain("Topology");
  });

  test("an unknown import is named, with what can be imported", async () => {
    const result = await compileScene(`import x from "lodash";\nexport default () => String(x);`);

    expect(result.ok ? "" : result.error.message).toContain('"lodash"');
    expect(result.ok ? "" : result.error.message).toContain('"svjeez/params"');
  });
});
