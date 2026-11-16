/** @jsxImportSource svjeez */
import type { ElementProps } from "./jsx-runtime";
import { node, type Child, type Element } from "./svg";

export type AmbientProps = ElementProps<"g"> & { readonly children?: Child };

/**
 * A `<g>` whose motions, and every motion inside it, stay on the clock when a page hands the scene to a scroll or view
 * timeline with `restyle(svg, { timeline })`: wheels that keep turning while the scroll moves the camera past them.
 * Played on the clock, as a file or an `<img>`, it changes nothing. Its motions run as the scene wrote them, clip
 * offsets and all, so give each a `.loop(period)` or make it close over the scene's `duration`: under a timeline the
 * rest of the scene no longer restarts with it.
 */
export const Ambient = (props: AmbientProps): Element => ({
  ...node("g", { ...props }),
  ambient: true,
});
