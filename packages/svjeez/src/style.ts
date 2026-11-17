import { Css } from "./properties";
import type { SvgNode } from "./svg";

export interface StyleProps {
  readonly css?: string | Css;
  readonly children?: string;
}

/**
 * A global CSS rule from inside a scene: render puts it in the scene's `<style>` after `render({ css })`. Property holes
 * get the same names, and the same `prefix`, as everywhere else. Selectors you write are not renamed.
 */
export const Style = ({ css, children }: StyleProps): SvgNode => ({
  kind: "style",
  css: css ?? children ?? "",
});
