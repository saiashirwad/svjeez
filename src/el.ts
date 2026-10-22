import { TAGS, type Tag } from "./attributes";
import type { ElementProps } from "./jsx-runtime";
import { node, type Child, type SvgNode } from "./svg";

type Helpers = { readonly [T in Tag]: (props?: ElementProps<T>, content?: Child) => SvgNode };

/** `el.<tag>(props, content)`: the same element JSX builds, for config-heavy calls. Destructures: `const { rect } = el`. */
export const el = Object.fromEntries(
  TAGS.map((tag) => [tag, (props: Record<string, unknown> = {}, content?: Child) => node(tag, { ...props, children: content })]),
) as Helpers;
