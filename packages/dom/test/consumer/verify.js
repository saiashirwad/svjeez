import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { browser, Dom, duration, size, wait } from "@svjeez/dom";
import * as fidelity from "@svjeez/dom/fidelity";
import { given, message, story } from "@svjeez/dom/story";
import { recordings } from "@svjeez/dom/vite";
import { jsx } from "svjeez/jsx-runtime";
import { render } from "svjeez";
import { validateSvg } from "svjeez/frames";

assert.ok(fidelity.fidelity);

// A story runs a program's messages into a flow, and the flow runs in Chromium.
const counter = {
  update: (n, by) => [n + by, []],
  view: (n) => `<p data-part="count" style="font: 20px sans-serif">${n}</p>`,
};

const { html, flow } = await story(counter, [given(0), message(2)]);

await using dom = await browser({ schemes: "light" });
const steps = await dom.run(html, [...flow, wait(0.5)]);

assert.equal(steps.length, 3);

const svg = render(
  { ...size(steps), duration: duration(steps) },
  jsx(Dom, { states: steps }),
);

assert.deepEqual(validateSvg(svg).errors, []);

// A demo of a real component runs through the app's own Vite, for each framework.
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
    const demos = await recordings(file, { cache: join(dir, `${framework}.json`), schemes: "light" });

    assert.deepEqual(texts(demos.counter), ["Count: 0", "Count: 1", "Total: 1"], framework);
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}

console.log("recorded a React demo and a Svelte demo, and rendered a flow");
