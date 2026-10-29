import { Fragment, jsx } from "./jsx-runtime";
import { remember, type JsxSource } from "./sources";
import type { Props, SvgNode } from "./svg";

export { Fragment };

/** The development JSX runtime: `jsx`, and it records where each element was written for `render({ sources: true })`. */
export const jsxDEV = (
  type: Parameters<typeof jsx>[0],
  props: Props | null,
  _key?: string | number,
  _isStaticChildren?: boolean,
  source?: JsxSource,
): SvgNode => remember(jsx(type, props), source);
