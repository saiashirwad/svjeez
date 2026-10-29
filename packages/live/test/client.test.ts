import { describe, expect, test } from "bun:test";
import { createCompiler } from "../src/client.ts";

const dot = `import { render } from "svjeez";
export default () => render({ width: 10, height: 10, duration: 1, title: "t" }, <circle r={2} />);`;

const endless = `export default () => { while (true) {} };`;

describe("createCompiler", () => {
  test("a scene that never finishes fails with the reason, and the next compile runs on a fresh worker", async () => {
    const compile = createCompiler({ timeout: 1000 });

    try {
      const stuck = await compile(endless);
      expect(stuck).toMatchObject({
        ok: false,
        error: { message: expect.stringContaining("without finishing") },
      });
      expect((await compile(dot)).ok).toBe(true);
    } finally {
      compile.stop();
    }
  }, 30_000);

  test("after stop, a compile fails at once rather than waiting forever", async () => {
    const compile = createCompiler();
    compile.stop();

    expect(await compile(dot)).toMatchObject({ ok: false });
  });
});
