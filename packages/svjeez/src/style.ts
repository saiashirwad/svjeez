import { Css } from "./properties";
import type { SvgNode } from "./svg";

export interface StyleProps {
  /** The rule, as text or as `css` so it can name registered properties. */
  readonly css?: string | Css;
  /** The rule as plain text, in place of `css`. */
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
