import { REDUCED_MOTION } from "./css";
import { num } from "./format";
import type { Seconds } from "./motion";
import { rateOf } from "./rate";

export interface RestyleOptions {
  /** CSS added after the scene's own, so its rules win: a scheme's `--base00`…`--base0F`, for one. */
  readonly css?: string;
  /** Start this many scene seconds in, as if the copy had been playing that long. */
  readonly at?: Seconds;
  /** Where the parts inside `<Once>` start, or are held with `paused`. Default `at`, as if they had played as long as the rest: `onceAt: 0` plays them from the top while the rest starts `at` seconds in. */
  readonly onceAt?: Seconds;
  /** Hold the frame at `at` (default 0) instead of playing on from it, whatever the viewer's reduced-motion setting. Animations of your own CSS pause where they start. */
  readonly paused?: boolean;
  /** Hold the reduced-motion still frame whatever the viewer's setting, ignoring `at` and `paused`. Animations of your own CSS pause where they start, and so does every motion of a scene rendered with `reducedMotion: false`, which has no still frame. */
  readonly still?: boolean;
}

const PAUSE = "*{animation-play-state:paused!important}";

/**
 * SMIL cannot be paused from markup, so a held `<animate>` ends just after the copy starts and freezes there. Chromium
 * shows the base value for an animation that ends at 0, hence the millisecond.
 */
const HOLD = 0.001;

/** How long an `<animate>` runs: `dur` times a numeric `repeatCount`, or forever. */
const activeDuration = (tag: string): Seconds => {
  const dur = parseFloat(/\sdur="([\d.]+)s"/.exec(tag)?.[1] ?? "");
  const repeats = parseFloat(/\srepeatCount="([\d.]+)"/.exec(tag)?.[1] ?? "");

  return dur * repeats || Infinity;
};

const WINDOWED =
  /(<animate\b[^>]*\sdata-loop="[^"]*"[^>]*\/>)((?:\s*<set\b[^>]*\sdata-loop="[^"]*"[^>]*\/>)*)/g;

const attr = (tag: string, name: string): string =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "";

/**
 * An `<animate>` the compiler cut down to the part of the loop where it moves, with the `<set>`s that hold its first
 * value before the window, seen `clock` seconds into the loop. Paused, it holds the frame at the clock. Otherwise it
 * starts there. The attribute itself holds the still frame, so each stretch outside the window is a `<set>`.
 */
const windowedAt = (tag: string, sets: string, clock: Seconds, paused?: boolean) => {
  const loop = parseFloat(attr(tag, "data-loop"));
  const start = parseFloat(attr(tag, "begin"));
  const length = parseFloat(attr(tag, "dur"));
  const id = attr(tag, "id");
  const name = attr(tag, "attributeName");
  const values = attr(tag, "values").split(";");

  const hold = (value: string | undefined, dur?: Seconds) =>
    `<set attributeName="${name}" to="${value}" begin="0s"${dur === undefined ? "" : ` dur="${num(dur)}s" fill="freeze"`}/>`;

  const rest = (begin: string) => tag.replace(/(\sbegin=")[^"]*/, `$1${begin}`);

  if (paused) {
    if (clock <= start) return hold(values[0]);
    const begin = HOLD - Math.max(Math.min(clock - start, length), HOLD);

    return rest(`${num(begin)}s`).replace(/\/>$/, ` end="${num(HOLD)}s"/>`);
  }

  const over = clock >= start + length;
  const begin = `${num(start - clock + (over ? loop : 0))}s;${id}.begin+${num(loop)}s`;
  const again = /\sbegin="[^"]*;([^"]*\.begin\+[^"]*)"/.exec(sets)?.[1];

  const reset =
    again === undefined
      ? ""
      : `<set attributeName="${name}" to="${values[0]}" begin="${again}" dur="${num(start)}s" fill="freeze"/>`;

  // Before the window the first value shows, and past it the last value, until the next loop begins.
  return (
    (over ? hold(values.at(-1), start - clock + loop) : "") +
    rest(begin) +
    (clock < start && start > 0 ? hold(values[0], start - clock) : "") +
    reset
  );
};

/** A copy of a rendered SVG with more CSS, started or held `at` seconds in, or held at its still frame. A page uses it to recolor or pause an `<img>` without restarting it. */
export const restyle = (
  svg: string,
  { css, at, onceAt, paused, still }: RestyleOptions,
): string => {
  for (const [name, value] of [
    ["at", at],
    ["onceAt", onceAt],
  ] as const)
    if (value !== undefined && !(Number.isFinite(value) && value >= 0))
      throw new Error(`restyle() needs ${name} of 0 or more, got ${value}.`);

  let out = svg;
  const rate = rateOf(svg);

  const extra = [css, (still || paused) && PAUSE].filter(Boolean).join("\n");

  if (still) out = out.replace(REDUCED_MOTION, "@media all{");
  else if (at || paused || onceAt !== undefined) {
    // The tools take scene seconds, and the animations run in playback seconds.
    const loop = (at ?? 0) / rate;
    const once = (onceAt ?? at ?? 0) / rate;
    const clocks = `--t0:-${num(loop)}s${onceAt === undefined ? "" : `;--t1:-${num(once)}s`}`;
    out = out.replace(/<svg\b[^>]*>/, (root) =>
      /\sstyle="/.test(root)
        ? root.replace(/\sstyle="/, `$&${clocks};`)
        : root.replace(/\s*\/?>$/, ` style="${clocks}"$&`),
    );
    out = out.replace(WINDOWED, (_, tag: string, sets: string) =>
      windowedAt(tag, sets, loop % (parseFloat(attr(tag, "data-loop")) || Infinity), paused),
    );
    out = out.replace(/<animate\b(?![^>]*\sbegin=)[^>]*>/g, (tag) => {
      const clock = /\sdata-once=/.test(tag) ? once : loop;
      // Chromium drops `fill="freeze"` when the whole interval ended before the copy started, so an animation that
      // repeats a set number of times ends no earlier than just after the start.
      const runs = activeDuration(tag);

      // Held, an animation runs from `clock` seconds before the end to the end, and so freezes on the frame at `clock`.
      const begin = paused
        ? HOLD - Math.max(Math.min(clock, runs), HOLD)
        : -Math.min(clock, runs - HOLD);

      const hold = paused
        ? ` end="${num(HOLD)}s"${/\sfill=/.test(tag) ? "" : ' fill="freeze"'}`
        : "";

      return tag.replace(/^<animate\b/, `<animate begin="${num(begin)}s"${hold}`);
    });

    if (paused) out = out.replace(REDUCED_MOTION, "@media not all{");
  }

  if (extra) {
    const close = out.lastIndexOf("</svg>");
    out = `${out.slice(0, close)}<style>${extra}</style>${out.slice(close)}`;
  }

  return out;
};
