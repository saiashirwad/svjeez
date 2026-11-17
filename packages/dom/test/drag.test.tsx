/** @jsxImportSource svjeez */
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { font } from "svjeez";
import { fidelity } from "../src/fidelity.tsx";
import { drag, find, shotsDir, snap, snapshots, wait, type Box, type Step } from "../src/index.ts";

const regular = font(
  readFileSync(join(import.meta.dir, "../../svjeez/tests/fixtures/SpaceMono-Regular.ttf")),
  { family: "Space Mono" },
);

const css = `
  .board { display: flex; gap: 12px; padding: 12px; background: #eee; font: 14px "Space Mono" }
  .lane { width: 160px; height: 200px; padding: 8px; border-radius: 10px; background: #ddd }
  .card { padding: 10px; border-radius: 8px; background: #fff; user-select: none }
  .card.held { box-shadow: 0 6px 16px rgb(0 0 0 / .3) }
`;

// A card that the mouse carries to the other lane: pressed, it lifts; let go over a lane, it lands there.
const markup = `<div class="board">
  <div class="lane" data-part="todo" data-key="todo" onpointerup="window.held && (this.append(window.held), window.held.classList.remove('held'), window.held = null)">
    <div class="card" data-part="card" data-key="card" onpointerdown="window.held = this; this.classList.add('held')">Card</div>
  </div>
  <div class="lane" data-part="done" data-key="done" onpointerup="window.held && (this.append(window.held), window.held.classList.remove('held'), window.held = null)"></div>
</div>`;

let root: string;
let steps: readonly Step[];

beforeAll(async () => {
  root = mkdtempSync(join(tmpdir(), "svjeez-drag-"));

  steps = await snapshots(
    join(root, "snapshots.json"),
    { fonts: [regular], css, screenshots: join(root, "shots") },
    (dom) =>
      dom.run(markup, [
        snap("idle"),
        wait(0.3),
        ...drag("card", "done", {
          lifted: snap("lifted", { over: 0.2 }),
          dropped: snap("dropped", { over: 0.4 }),
          carried: false,
        }),
        wait(0.3),
      ]),
  );
}, 60000);

afterAll(() => rmSync(root, { recursive: true, force: true }));

/** A lane in the snapshot with this name, by key. */
const lane = (name: string, key: string): Box | undefined =>
  find(steps, name)?.root.children.find((c): c is Box => c.kind === "box" && c.key === key);

describe("drag", () => {
  test("presses, carries and lets go with the real mouse, and the page reacts as to a person", () => {
    expect(lane("idle", "todo")?.children).toHaveLength(1);
    // Held, the card lifts: the page gave it a shadow.
    expect(lane("lifted", "todo")?.children[0]).toMatchObject({
      kind: "box",
      key: "card",
      shadows: [expect.any(Object)],
    });
    expect(lane("dropped", "todo")?.children).toHaveLength(0);
    expect(lane("dropped", "done")?.children[0]).toMatchObject({ key: "card" });
  });

  test("each state, drawn with the card moved across lanes and held between, matches what Chromium painted", async () => {
    const results = await fidelity(shotsDir(join(root, "shots"), join(root, "snapshots.json")));

    expect(results.map((r) => r.name).sort()).toContain("dropped");
    expect(results.filter((r) => r.failed)).toEqual([]);
  }, 60000);
});
