import { TAGS, type Attrs, type Tag } from "./attributes";
import type { AnimatedTag, TagChannels } from "./channels";
import type { Stack } from "./motion";
import { node, type Child, type SvgNode } from "./svg";

/** The props of an element: its attributes, plus `animation` on the tags that animate. */
export type ElementProps<T extends Tag> = Attrs<T> &
  (T extends AnimatedTag ? { readonly animation?: Stack<TagChannels<T>> } : {});

type Helpers = { readonly [T in Tag]: (props?: ElementProps<T>, content?: Child) => SvgNode };

/** `el.<tag>(props, content)`: the same element JSX builds, for config-heavy calls. Destructures: `const { rect } = el`. */
export const el = Object.fromEntries(
  TAGS.map((tag) => [
    tag,
    (props: Record<string, unknown> = {}, content?: Child) =>
      node(tag, { ...props, children: content }),
  ]),
) as Helpers;
