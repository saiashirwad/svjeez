import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Item, Snapshot } from "../src/tree.ts";
import { recordings } from "../src/vite.ts";

const fixture = fileURLToPath(new URL("./fixtures/counter.demo.tsx", import.meta.url));
const svelteFixture = fileURLToPath(new URL("./fixtures/svelte/counter.demo.ts", import.meta.url));

const texts = (snapshot: Snapshot): string[] => {
  const out: string[] = [];

  const visit = (item: Item) => {
    if (item.kind === "text") out.push(item.text);

    if (item.kind === "box") item.children.forEach(visit);
  };

  visit(snapshot.root);

  return out;
};

const states = (steps: readonly unknown[]) =>
  steps.flatMap((s) => {
    // SAFETY: a step is a snapshot, or a snapshot and its timing, or a wait, which has no root.
    const state = (Array.isArray(s) ? s[0] : s) as Snapshot;

    return "root" in state ? [state] : [];
  });

test("a demo keeps state across clicks and re-renders with new props", async () => {
  const dir = await mkdtemp(join(tmpdir(), "svjeez-demo-"));

  try {
    const demos = await recordings<typeof import("./fixtures/counter.demo.tsx")>(fixture, {
      cache: join(dir, "snapshots.json"),
      schemes: "light",
    });

    expect(Object.keys(demos).sort()).toEqual(["counter", "labelled"]);
    expect(states(demos.counter).map((s) => texts(s).join(""))).toEqual([
      "Count:0",
      "Count:1",
      "Total:1",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60_000);

test("a Svelte demo keeps state across clicks and updates its props in place", async () => {
  const dir = await mkdtemp(join(tmpdir(), "svjeez-demo-"));

  try {
    const demos = await recordings<typeof import("./fixtures/svelte/counter.demo.ts")>(
      svelteFixture,
      {
        cache: join(dir, "snapshots.json"),
        schemes: "light",
      },
    );

    expect(states(demos.counter).map((s) => texts(s).join(""))).toEqual([
      "Count: 0",
      "Count: 1",
      "Total: 1",
    ]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60_000);
