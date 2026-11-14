import type { Step } from "./timeline.ts";
import type { Box, Item, Rect, Snapshot } from "./tree.ts";

/** Every element with this part, in document order. Their `box` says where each landed. */
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

/** Where the `index`th element with this part landed, in the snapshot's coordinates. */
export const rect = (snapshot: Snapshot, part: string, index = 0): Rect | undefined =>
  boxes(snapshot, part)[index]?.box;

/** The first snapshot that `snap(name)` read, among the steps `card.run` gave. */
export const find = (steps: readonly Step[], name: string): Snapshot | undefined =>
  steps
    .flatMap((step) => ("wait" in step ? [] : "root" in step ? [step] : [step[0]]))
    .find((state) => state.name === name);
