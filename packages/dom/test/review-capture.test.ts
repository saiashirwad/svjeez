import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { chromium, type Browser, type Page } from "playwright-core";
import { captureScript, type ElementNode, type Node, type Snapshot } from "../src/index.ts";

let browser: Browser;
let page: Page;

beforeAll(async () => {
  browser = await chromium.launch().catch(() => chromium.launch({ channel: "chrome" }));
  page = await browser.newPage({ viewport: { width: 400, height: 300 } });
}, 60_000);

afterAll(async () => {
  await browser?.close();
});

const snap = async (html: string): Promise<Snapshot> => {
  await page.setContent(
    `<style>html,body{margin:0;padding:0;font:16px/20px monospace}</style><div id="root">${html}</div>`,
  );

  return page.evaluate<Snapshot>(`(${captureScript})(document.getElementById("root"))`);
};

const find = (node: Node, test: (el: ElementNode) => boolean): ElementNode | undefined => {
  if (node.type !== "element") return undefined;

  if (test(node)) return node;

  for (const child of node.children) {
    const found = find(child, test);

    if (found) return found;
  }

  return undefined;
};

const byId = (snapshot: Snapshot, id: string) => {
  const found = find(snapshot.root, (el) => el.id === id);

  if (!found) throw new Error(`no #${id} in the snapshot`);

  return found;
};

const words = (node: Node): string[] =>
  node.type === "text"
    ? [node.runs.map((run) => run.text ?? "").join("")]
    : node.children.flatMap(words);

const angleOf = (snapshot: Snapshot, id: string) => {
  const layer = byId(snapshot, id).backgrounds?.[0];

  if (layer?.kind !== "linear") throw new Error("not a linear gradient");

  return layer.angle;
};

describe("form control text color", () => {
  test("a control's value uses the control's color, not the root's", async () => {
    await page.setContent(
      `<style>html{color:#111}input{color:rgb(255,255,255);background:#000;border:0}</style><div id="root"><input id="i" value="hello"></div>`,
    );

    const snapshot = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("root"))`,
    );

    const runs = JSON.stringify(byId(snapshot, "i"));

    expect(runs).toContain("255, 255, 255");
    expect(runs).not.toContain("17, 17, 17");
  });
});

describe("linear-gradient corner keywords", () => {
  test("all four corners on a 200x100 box", async () => {
    const expected = new Map([
      ["to top right", 26.565],
      ["to bottom right", 153.435],
      ["to bottom left", 206.565],
      ["to top left", 333.435],
    ]);

    for (const [keyword, angle] of expected) {
      const snapshot = await snap(
        `<div id="g" style="width:200px;height:100px;background:linear-gradient(${keyword}, red, blue)"></div>`,
      );

      expect(Math.abs(angleOf(snapshot, "g") - angle)).toBeLessThan(0.01);
    }
  });
});

describe("@font-face collection", () => {
  test("rules inside @media, @supports, @layer and @import are found", async () => {
    const face = (name: string) =>
      `@font-face{font-family:"${name}";src:url(https://example.test/${name}.woff2)}`;

    const imported = `data:text/css,${encodeURIComponent(face("Imported"))}`;

    const snapshot = await snap(
      `<style>@import url("${imported}");
@media all{${face("Media")}}
@supports (display:block){${face("Supports")}}
@layer base{${face("Layer")}}
${face("Top")}</style>x`,
    );

    const families = (snapshot.fonts ?? []).map((font) => font.family).sort();

    expect(families).toEqual(["Imported", "Layer", "Media", "Supports", "Top"].sort());
  });
});

describe("pseudo-elements on a shadow host", () => {
  test("::before and ::after sit around the shadow tree", async () => {
    await page.setContent(
      `<style>html,body{margin:0;font:16px/20px monospace}x-h::before{content:"B"}x-h::after{content:"A"}</style><div id="root"><x-h id="h"></x-h></div>`,
    );
    await page.evaluate(() => {
      customElements.define(
        "x-h",
        class extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: "open" }).innerHTML = `<i>mid</i>`;
          }
        },
      );
    });

    const snapshot = await page.evaluate<Snapshot>(
      `(${captureScript})(document.getElementById("root"))`,
    );

    expect(words(byId(snapshot, "h"))).toEqual(["B", "mid", "A"]);

    const left = await page.evaluate(() => {
      const host = document.getElementById("h");

      return [host?.childNodes.length, host?.shadowRoot?.childNodes.length];
    });

    expect(left).toEqual([0, 1]);
  });
});
