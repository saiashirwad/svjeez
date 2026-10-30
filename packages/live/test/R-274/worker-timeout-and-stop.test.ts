import { describe, expect, test } from "bun:test";
import { createCompiler } from "../../src/client.ts";
import { fakeWorkers, wait } from "../helpers/live-timing";

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

describe("createCompiler with jobs in flight together", () => {
  test("a timeout fails only the jobs on the stuck worker, and a job sent after it on the fresh worker finishes", async () => {
    const { restore } = fakeWorkers(40);

    try {
      const compile = createCompiler({ timeout: 100 });
      const stuck = compile("loop");
      await wait(50);
      const alongside = compile("loop");
      await wait(60);
      const after = compile("fine");

      expect((await stuck).ok).toBe(false);
      expect((await alongside).ok).toBe(false);
      expect(await after).toMatchObject({ ok: true, svg: "fine" });
      compile.stop();
    } finally {
      restore();
    }
  });

  test("no worker starts after stop, even when a job's time runs out later", async () => {
    const { made, restore } = fakeWorkers(40);

    try {
      const compile = createCompiler({ timeout: 50 });
      const pending = compile("loop");
      compile.stop();
      expect((await pending).ok).toBe(false);
      await wait(100);

      expect(made.spawned).toBe(1);
    } finally {
      restore();
    }
  });
});
