import type { JsxSource } from "../sources";
import { caller } from "../traced";
import { remember } from "./identity";
import { Fragment, build, jsx, type JSX } from "./jsx-runtime";
import type { Child, SceneElement } from "./nodes";

export { Fragment, jsx, jsx as jsxs, type JSX };

type Component<P> = (props: P) => SceneElement;

export function jsxDEV(
  type: typeof Fragment,
  props: { readonly children?: Child },
  key?: string,
  isStaticChildren?: boolean,
  source?: JsxSource,
): SceneElement;
export function jsxDEV<P>(
  type: Component<P>,
  props: P,
  key?: string,
  isStaticChildren?: boolean,
  source?: JsxSource,
): SceneElement;
/** The development transform's call: the element `jsx` makes, remembering where it was written. */
export function jsxDEV<P extends { readonly children?: Child }>(
  type: Component<P> | typeof Fragment,
  props: P,
  key?: string,
  _isStaticChildren?: boolean,
  source?: JsxSource,
): SceneElement {
  return remember(build(type, props, key), source ?? caller());
}
