import { SceneError } from "../model/scene-error";
import { NAME } from "./clock";
import { centered } from "./layout";
import type { Child, Common, SceneElement } from "./nodes";

export interface SlotProps extends Common {
  /** The name page code finds the slot by, with `scene.slot(name)`. Each slot in a scene has its own. */
  readonly name: string;
  readonly width: number;
  readonly height: number;
  /** The fallback, centered in the box: what the plain SVG shows, and the page whenever it hosts nothing here. */
  readonly children?: Child;
}

const isLength = (value: number) => value > 0 && Number.isFinite(value);

/**
 * A box of `width` by `height` that page code can fill with its own HTML, such as a canvas: `scene.slot(name).host(node)`
 * puts the node in the box, where the scene's layout, motion and clocks move it. It lays out like a `<Center>` of that
 * size, and draws its children until the page hosts something. It is written as a `<g data-slot="name"
 * data-slot-box="x y width height">` around the children, the box in the group's own units.
 */
export const Slot = ({
  name,
  width,
  height,
  children,
  ...props
}: SlotProps): Extract<SceneElement, { readonly type: "group" }> => {
  if (!NAME.test(name))
    throw new SceneError(
      `<Slot> needs a name of letters, digits, - and _ that starts with a letter, got ${JSON.stringify(name)}.`,
      'Name it as in <Slot name="field" width={240} height={160}>.',
    );

  if (!isLength(width) || !isLength(height))
    throw new SceneError(
      `<Slot name="${name}"> needs a width and a height above 0, got ${width} by ${height}.`,
      "Give it the size of the box the page fills.",
    );

  return { ...centered("<Slot>", { ...props, width, height, children }), slot: name };
};
