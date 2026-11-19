import { expect, test } from "bun:test";
import { join } from "node:path";
import { film } from "../src/index.ts";
import { serve } from "../src/vite.ts";

const root = join(import.meta.dir, "app");

test("serve hashes the project's modules and films the page", async () => {
  const server = await serve({ root });

  try {
    expect(await server.sources()).toBe(await server.sources());
    expect(server.url).toMatch(/^http:\/\/localhost:\d+\/$/);
  } finally {
    await server.close();
  }

  const board = await film(
    serve({ root }),
    "#app",
    async ({ page, snap }) => {
      await snap("start");
      await page.click("#add");
      await snap("added");
    },
    { onDiagnostics: () => {} },
  );

  expect(board.duration).toBeGreaterThan(0);
});
