import type { JsxSource } from "./author/sources";
import { caller } from "./svg/traced";
import { remember } from "./author/identity";
import { Fragment, build, jsx, type JSX } from "./jsx-runtime";
import type { Child, SceneElement } from "./author/nodes";

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
export function jsxDEV<P extends { readonly children?: Child }>(
  type: Component<P> | typeof Fragment,
  props: P,
  key?: string,
  _isStaticChildren?: boolean,
  source?: JsxSource,
): SceneElement {
  return remember(build(type, props, key), source ?? caller());
}
