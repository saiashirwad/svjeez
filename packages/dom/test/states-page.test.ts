import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { scene } from "svjeez";
import { boxesOf, svg } from "svjeez/tools";
import { compile, openPage, record, type Snapshot } from "../src/index.ts";

const html = `<!doctype html>
<style>
  html, body { margin: 0 }
  #app { width: 400px; height: 300px; position: relative; font: 14px monospace; background: #fff }
  #list { position: absolute; left: 0; top: 0; width: 150px; margin: 0; padding: 0; list-style: none }
  #list li { height: 24px; margin-bottom: 6px; background: #cde }
  .col { position: absolute; top: 0; width: 100px; height: 200px; background: #eee }
  #left { left: 200px } #right { left: 320px }
  .card { margin: 8px; height: 30px; background: #fc8 }
</style>
<div id="app" data-key="app">
  <ul id="list" data-key="list">
    <li data-key="a">apple</li><li data-key="b">banana</li><li data-key="c">cherry</li>
  </ul>
  <div class="col" id="left"><div class="card" data-key="card">move me</div></div>
  <div class="col" id="right"></div>
</div>`;

const server = Bun.serve({
  port: 0,
  fetch: () => new Response(html, { headers: { "content-type": "text/html" } }),
});

let opened: Awaited<ReturnType<typeof openPage>>;

beforeAll(async () => {
  opened = await openPage({ url: `http://localhost:${server.port}/` });
}, 60_000);

afterAll(async () => {
  await opened?.close();
  await server.stop(true);
});

/** Every data-key'd element's top-left corner in a snapshot, relative to the root. */
const corners = (snapshot: Snapshot) => {
  const out = new Map<string, [number, number]>();

  const visit = (node: Snapshot["root"]) => {
    if (node.key)
      out.set(node.key, [node.rect.x - snapshot.root.rect.x, node.rect.y - snapshot.root.rect.y]);

    for (const child of node.children) if (child.type === "element") visit(child);
  };

  visit(snapshot.root);

  return out;
};

describe("states of a real page", () => {
  test("an added, a removed and a reordered item and a card changing column animate, and end where the page was", async () => {
    const { page } = opened;

    const states = await record(page, "#app", async (snap) => {
      await snap("start");

      await page.evaluate(() => {
        const list = document.querySelector("#list")!;
        const [a, b, c] = [...list.children];

        b!.remove();

        const d = document.createElement("li");

        d.dataset["key"] = "d";
        d.textContent = "date";
        list.append(c!, a!, d);

        document.querySelector("#right")!.append(document.querySelector(".card")!);
      });

      await snap("changed");
    });

    const compiled = compile(states);

    expect(compiled.diagnostics).toEqual([]);

    const model = scene(
      { size: compiled.size, duration: compiled.duration, title: "app" },
      () => compiled.element,
    );

    expect(svg.emit(model)).toContain("<svg");

    const first = corners(states[0]!.snapshot);
    const last = corners(states.at(-1)!.snapshot);

    const find = (t: number, key: string) => {
      const boxes = boxesOf(model, t);
      const path = Object.keys(boxes).find((one) => one.split("/").at(-1) === key);

      return path === undefined ? undefined : boxes[path];
    };

    for (const [key, [x, y]] of last) {
      const end = find(compiled.duration, key)!;

      expect(end.x).toBeCloseTo(x, 1);
      expect(end.y).toBeCloseTo(y, 1);
    }

    for (const [key, [x, y]] of first) {
      const start = find(0, key)!;

      expect(start.x).toBeCloseTo(x, 1);
      expect(start.y).toBeCloseTo(y, 1);
    }

    const [cx] = first.get("card")!;
    const [lx] = last.get("card")!;
    const mid = find(0.8 + 0.3, "card")!;

    expect(lx).toBeGreaterThan(cx);
    expect(mid.x).toBeGreaterThan(cx);
    expect(mid.x).toBeLessThan(lx);
    expect(find(0.8 + 0.3, "c")!.y).toBeLessThan(first.get("c")![1]);
  }, 60_000);
});
