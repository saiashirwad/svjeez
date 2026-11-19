import { afterAll, describe, expect, test } from "bun:test";
import { svg } from "svjeez/tools";
import { scene, type SceneElement } from "svjeez";
import {
  compile,
  film,
  openPage,
  record,
  type FilmContext,
  type State,
  type Target,
} from "../src/index.ts";

const html = `<!doctype html>
<style>
  html, body, p { margin: 0 }
  #app { position: relative; width: 300px; height: 200px; font: 16px/20px monospace }
  button { position: absolute; left: 40px; top: 60px; width: 80px; height: 30px }
</style>
<div id="app"><p id="out">idle</p><button data-part="go" onclick="out.textContent='clicked'">go</button></div>`;

const server = Bun.serve({
  port: 0,
  fetch: () => new Response(html, { headers: { "content-type": "text/html" } }),
});

const url = `http://localhost:${server.port}/`;

afterAll(() => server.stop(true));

const target = (): Target => ({
  url,
  selector: "#app",
  sources: async () => "cursor",
  close: async () => {},
});

const keys = (element: SceneElement, into: string[] = []): string[] => {
  // A morph has no props of its own: its states are the page, not the cursor.
  if (!("props" in element)) return into;

  if ("key" in element.props && element.props.key) into.push(element.props.key);

  if ("children" in element) for (const child of element.children) keys(child, into);

  return into;
};

const run = async (
  script: (
    page: Awaited<ReturnType<typeof openPage>>["page"],
    snap: (name: string) => Promise<State>,
  ) => Promise<void>,
) => {
  const { page, close } = await openPage({ url, viewport: { width: 320, height: 240 } });

  try {
    return await record(page, "#app", (snap) => script(page, snap), { cursor: true });
  } finally {
    await close();
  }
};

describe("cursor", () => {
  test("records where locator clicks and raw mouse moves put the mouse, and where it pressed", async () => {
    const states = await run(async (page, snap) => {
      await page.mouse.move(250, 150);
      await snap("start");
      await page.locator("button").click();
      await snap("clicked");
      await page.mouse.move(200, 20, { steps: 3 });
      await page.mouse.down();
      await snap("held");
      await page.mouse.up();
      await snap("up");
    });

    expect(states.map((state) => state.pointer)).toEqual([
      { at: [250, 150], down: false, presses: [] },
      { at: [80, 75], down: false, presses: [[80, 75]] },
      { at: [200, 20], down: true, presses: [[200, 20]] },
      { at: [200, 20], down: false, presses: [] },
    ]);
  }, 60_000);

  test("keeps following the mouse across a reload", async () => {
    const states = await run(async (page, snap) => {
      await page.mouse.move(100, 100);
      await snap("before");
      await page.reload();
      await page.waitForSelector("#app");
      await snap("reloaded");
      await page.mouse.move(150, 120);
      await snap("moved");
    });

    expect(states.map((state) => state.pointer?.at)).toEqual([
      [100, 100],
      [100, 100],
      [150, 120],
    ]);
  }, 60_000);

  test("no pointer before the mouse moves, and none without cursor", async () => {
    const { page, close } = await openPage({ url, viewport: { width: 320, height: 240 } });

    try {
      const off = await record(page, "#app", async (snap) => {
        await page.mouse.move(10, 10);
        await snap("off");
      });

      expect(off[0]!.pointer).toBeUndefined();
    } finally {
      await close();
    }

    const [still] = await run(async (_, snap) => {
      await snap("still");
    });

    expect(still!.pointer).toBeUndefined();
  }, 60_000);

  test("compiles to an arrow over the page, with a press ring where a button went down", async () => {
    const states = await run(async (page, snap) => {
      await page.mouse.move(250, 150);
      await snap("start");
      await page.locator("button").click();
      await snap("clicked");
    });

    const { element } = compile(states.map((state) => ({ ...state, over: 0.4 })));
    const found = keys(element);

    expect(found).toContain("@cursor");
    expect(found).toContain("arrow");
    expect(found.filter((key) => key.startsWith("ring-"))).toHaveLength(1);

    // A mouse that first shows up with a press fades in where it pressed, then moves on with the page.
    const late = await run(async (page, snap) => {
      await snap("still");
      await page.mouse.move(200, 20);
      await page.mouse.down();
      await page.mouse.move(250, 150);
      await page.mouse.up();
      await snap("dragged");
    });

    expect(late[1]!.pointer).toEqual({ at: [250, 150], down: false, presses: [[200, 20]] });
    svg.emit(scene({ size: [320, 240], duration: 2, title: "late" }, () => compile(late).element));

    // Without the pointer, the same states compile to the page alone.
    const bare = compile(states.map(({ name, snapshot }) => ({ name, snapshot, over: 0.4 })));

    expect(keys(bare.element)).not.toContain("@cursor");
  }, 60_000);

  test("film draws the cursor only when asked", async () => {
    const script = async ({ page, snap }: FilmContext) => {
      await page.mouse.move(250, 150);
      await snap("start");
      await page.locator("button").click();
      await snap("clicked");
    };

    const options = { viewport: { width: 320, height: 240 }, onDiagnostics: () => {} };
    const on = svg.emit(await film(target(), script, { ...options, cursor: true }));
    const off = svg.emit(await film(target(), script, options));

    expect(on).toContain("svjeez-cursor-ring");
    expect(off).not.toContain("svjeez-cursor-ring");
  }, 60_000);
});
