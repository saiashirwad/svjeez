import { snapshotOf, type Step } from "./timeline.ts";
import type { Box, Item, Rect, Snapshot } from "./tree.ts";

export const boxes = (snapshot: Snapshot, part: string): Box[] => {
  const found: Box[] = [];

  const visit = (item: Item) => {
    if (item.kind !== "box") return;

    if (item.part === part) found.push(item);
    item.children.forEach(visit);
  };

  visit(snapshot.root);

  return found;
};

export const rect = (snapshot: Snapshot, part: string, index = 0): Rect | undefined =>
  boxes(snapshot, part)[index]?.box;

export const find = (steps: readonly Step[], name: string): Snapshot | undefined =>
  steps.map(snapshotOf).find((state) => state?.name === name);
