import type { Snapshot } from "./snapshot.ts";
import type { Box, Item } from "./tree.ts";

/** Every element with this `data-part`, in document order. Their `box` says where each landed. */
export const parts = (snapshot: Snapshot, part: string): Box[] => {
  const found: Box[] = [];

  const visit = (item: Item) => {
    if (item.kind !== "box") return;

    if (item.part === part) found.push(item);
    item.children.forEach(visit);
  };

  visit(snapshot.root);

  return found;
};
