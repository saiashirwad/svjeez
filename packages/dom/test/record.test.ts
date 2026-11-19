import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scene } from "svjeez";
import { svg } from "svjeez/tools";
import { compile, inlineAssets, openPage, record } from "../src/index.ts";
import { PNG } from "./fixtures.ts";

const FONT = readFileSync(
  join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf"),
);

const IMAGE = Buffer.from(PNG.split(",")[1]!, "base64");

const html = `<!doctype html>
<style>
  @font-face { font-family: Space; src: url(/space.ttf) format("truetype"); }
  :root { color-scheme: light dark }
  html, body { margin: 0 }
  #app { width: 240px; padding: 12px; font: 16px/20px Space, monospace; background: #fff; color: #111 }
  button { color: #0044cc; background: #eee; border: 1px solid #999 }
  img { width: 32px; height: 32px; display: block }
  @media (prefers-color-scheme: dark) {
    #app { background: #111; color: #eee }
    button { color: #66aaff; background: #222; border-color: #555 }
  }
</style>
<div id="app"><p id="out">empty</p><img src="/dot.png"><button onclick="out.textContent='typed'">go</button></div>`;

const server = Bun.serve({
  port: 0,
  fetch: ({ url }) => {
    const { pathname } = new URL(url);

    if (pathname === "/space.ttf")
      return new Response(FONT, { headers: { "content-type": "font/ttf" } });

    if (pathname === "/dot.png")
      return new Response(IMAGE, { headers: { "content-type": "image/png" } });

    return new Response(html, { headers: { "content-type": "text/html" } });
  },
});

let opened: Awaited<ReturnType<typeof openPage>>;

beforeAll(async () => {
  opened = await openPage({
    url: `http://localhost:${server.port}/`,
    viewport: { width: 320, height: 200 },
  });
}, 60_000);

afterAll(async () => {
  await opened?.close();
  await server.stop(true);
});

describe("record", () => {
  test("two states under both schemes compile to a themed scene with its font and image", async () => {
    const { page } = opened;

    const states = await record(
      page,
      "#app",
      async (snap) => {
        await snap("empty");
        await page.click("button");
        await snap("typed", { over: 0.8, ease: "out" });
      },
      { scheme: "both" },
    );

    expect(states.map((s) => s.name)).toEqual(["empty", "typed"]);
    expect(states[1]).toMatchObject({ over: 0.8, ease: "out" });
    expect(states[0]!.snapshot.fonts?.[0]).toMatchObject({ family: "Space" });
    expect(states[0]!.snapshot.root.background).toEqual({
      light: "rgb(255, 255, 255)",
      dark: "rgb(17, 17, 17)",
    });

    const [inlined] = await inlineAssets(states.map((s) => s.snapshot));
    const { element, size, diagnostics } = compile(inlined!);

    expect(diagnostics.map((d) => d.what)).toEqual([]);

    const out = svg.emit(scene({ size, duration: 1, title: "app" }, () => element));

    expect(out).toContain("@font-face");
    expect(out).toContain("data:image/png;base64");
    expect(out).toMatch(/--c-ffffff-111111:/);
    expect(out).toContain("var(--c-ffffff-111111");

    // The page is back in light after recording.
    expect(await page.evaluate(() => matchMedia("(prefers-color-scheme: dark)").matches)).toBe(
      false,
    );
  }, 60_000);

  test("a selector that matches nothing says so", async () => {
    expect(record(opened.page, "#nope", (snap) => snap("x").then(() => {}))).rejects.toThrow(
      /#nope/,
    );
  });
});
