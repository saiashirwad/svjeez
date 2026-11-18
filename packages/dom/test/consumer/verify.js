import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { browser, cssEase, find, loop, wait } from "@svjeez/dom";
import { given, message, story } from "@svjeez/dom/story";
import { recordings } from "@svjeez/dom/vite";

const counter = {
  update: (n, by) => [n + by, []],
  view: (n) => `<p data-part="count" style="font: 20px sans-serif">${n}</p>`,
};

const { html, flow } = await story(counter, [given(0), message(2)]);

const dom = await browser({ schemes: "light" });
let steps;

try {
  steps = await dom.run(html, [...flow, wait(0.5)]);
} finally {
  await dom.close();
}

assert.equal(steps.length, 3);

assert.equal(loop(steps).length, 4);

assert.equal(find(steps, "missing"), undefined);

assert.ok(cssEase("ease-in-out"));

const dir = await mkdtemp(join(tmpdir(), "svjeez-dom-"));

const texts = (steps) =>
  steps.flatMap((step) => {
    const state = Array.isArray(step) ? step[0] : step;

    if (!("root" in state)) return [];

    const out = [];

    const visit = (item) => {
      if (item.kind === "text") out.push(item.text);

      if (item.kind === "box") item.children.forEach(visit);
    };

    visit(state.root);

    return [out.join("")];
  });

try {
  for (const framework of ["react", "svelte"]) {
    const file = fileURLToPath(new URL(`./${framework}.demo.js`, import.meta.url));

    const demos = await recordings(file, {
      cache: join(dir, `${framework}.json`),
      schemes: "light",
    });

    assert.deepEqual(texts(demos.counter), ["Count: 0", "Count: 1", "Total: 1"], framework);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("recorded a React demo and a Svelte demo, and read a flow");
