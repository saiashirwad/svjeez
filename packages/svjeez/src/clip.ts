import { children, type Child, type SvgNode } from "./svg";
import { checkWindow, type When } from "./span";

export type ClipProps = When & { readonly children?: Child };

/**
 * A clock of its own. Every motion inside starts counting at `at`, so a component is written from 0 and placed anywhere,
 * and clips inside clips add up. With `over` the motions inside must end by then. It draws nothing: no element.
 * Outside its span a motion holds its first or last value, so a clip costs no keys.
 */
export const Clip = ({ at, over, children: content }: ClipProps): SvgNode => {
  checkWindow(at, over ?? 1, "<Clip>");

  const inside = children(content);

  return over === undefined
    ? { kind: "clip", at, children: inside }
    : { kind: "clip", at, over, children: inside };
};
