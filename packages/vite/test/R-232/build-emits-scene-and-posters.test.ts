import { afterAll, expect, test } from "bun:test";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { build } from "vite";
import { appConfig } from "../app/config.ts";

const scratch = mkdtempSync(join(import.meta.dirname, "../.scratch-"));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// hero.tsx has no JSX pragma, so this also checks that a scene compiles as svjeez inside a React app.
test("a build emits the scene and its posters, and the bundle holds only their URLs", async () => {
  const outDir = join(scratch, "dist");
  await build({ ...appConfig(), build: { outDir, emptyOutDir: true } });
  const files = readdirSync(join(outDir, "assets"));
  const svg = files.find((file) => /^hero-.*\.svg$/.test(file));
  const js = files.find((file) => file.endsWith(".js"));
  expect(svg).toBeDefined();
  expect(readFileSync(join(outDir, "assets", svg!), "utf8")).toStartWith("<svg");

  for (const scheme of ["light", "dark"]) {
    const poster = files.find(
      (file) => file.startsWith(`hero-${scheme}-`) && file.endsWith(".webp"),
    );

    expect(
      readFileSync(join(outDir, "assets", poster!))
        .subarray(8, 12)
        .toString(),
    ).toBe("WEBP");
  }

  const bundle = readFileSync(join(outDir, "assets", js!), "utf8");
  expect(bundle).toContain(`/assets/${svg}`);
  expect(bundle).not.toContain("@keyframes");
}, 120_000);
