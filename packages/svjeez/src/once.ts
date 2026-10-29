import type { ElementProps } from "./el";
import { node, type Child, type Element } from "./svg";

export type OnceProps = ElementProps<"g"> & { readonly children?: Child };

/**
 * A `<g>` whose motions, and every motion inside it, play the scene's timeline one time and then hold its last frame,
 * while the rest of a looping scene repeats. It keeps a clock of its own, so `restyle(svg, { at, onceAt: 0 })` starts
 * the rest of the scene `at` seconds in and plays these parts from the top.
 */
export const Once = (props: OnceProps): Element => ({ ...node("g", { ...props }), once: true });
