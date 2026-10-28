import { REDUCED_MOTION } from "./css";
import { num } from "./format";
import type { Seconds } from "./motion";

export interface RestyleOptions {
  /** CSS added after the scene's own, so its rules win: a scheme's `--base00`…`--base0F`, for one. */
  readonly css?: string;
  /** Start this many playback seconds in, as if the copy had been playing that long. */
  readonly at?: Seconds;
  /** Hold the reduced-motion still frame whatever the viewer's setting. Animations of your own CSS pause where they start, and so does every motion of a scene rendered with `reducedMotion: false`, which has no still frame. */
  readonly still?: boolean;
}

/** A copy of a rendered SVG with more CSS, started `at` seconds in, or held at its still frame. A page uses it to recolor an `<img>` without restarting it. */
export const restyle = (svg: string, { css, at, still }: RestyleOptions): string => {
  let out = svg;
  const extra = [css, still && "*{animation-play-state:paused!important}"].filter(Boolean).join("\n");
  if (still) out = out.replace(REDUCED_MOTION, "@media all{");
  else if (at) {
    const offset = `-${num(at)}s`;
    out = out.replace(/<svg\b[^>]*>/, (root) => (/\sstyle="/.test(root) ? root.replace(/\sstyle="/, `$&--t0:${offset};`) : root.replace(/\s*\/?>$/, ` style="--t0:${offset}"$&`)));
    out = out.replace(/<animate\b(?![^>]*\sbegin=)/g, `<animate begin="${offset}"`);
  }
  if (extra) {
    const close = out.lastIndexOf("</svg>");
    out = `${out.slice(0, close)}<style>${extra}</style>${out.slice(close)}`;
  }
  return out;
};
