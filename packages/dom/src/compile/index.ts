import type { SceneElement } from "svjeez";
import type { Snapshot } from "../schema.ts";
import { element, nameOf } from "./box.tsx";
import { context, type Diagnostic } from "./context.ts";

export type { Diagnostic } from "./context.ts";

export interface Compiled {
  /** The page as core scene elements, with the root's top-left corner at [0, 0]. */
  readonly element: SceneElement;
  /** The root's border box: the scene to draw it in. */
  readonly size: readonly [width: number, height: number];
  /** Everything that was approximated or left out. */
  readonly diagnostics: readonly Diagnostic[];
}

/** Compiles a Snapshot to core scene elements: groups, shapes, text and pictures, nothing a backend has to guess at. */
export const compile = ({ root, fonts }: Snapshot): Compiled => {
  const ctx = context(fonts);
  const key = nameOf(root, 0);

  return {
    element: element(root, [root.rect.x, root.rect.y], key, key, ctx),
    size: [root.rect.width, root.rect.height],
    diagnostics: ctx.diagnostics,
  };
};
