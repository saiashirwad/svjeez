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
 * A windowed `<animate>` (see `windowed` in smil.ts) with its `<set>`, seen `clock` seconds into the loop. Paused, it holds
 * the frame at the clock. Otherwise it starts there. The attribute holds the window's last value, so the first value is
 * set before the window, and the last again once the clock is past it.
 */
const windowedAt = (tag: string, sets: string, clock: Seconds, paused?: boolean) => {
  const loop = parseFloat(attr(tag, "data-loop"));
  const start = parseFloat(attr(tag, "begin"));
  const length = parseFloat(attr(tag, "dur"));
  const id = attr(tag, "id");
  const name = attr(tag, "attributeName");
  const [first, ...rest] = attr(tag, "values").split(";");
  const last = rest.at(-1);

  // Frozen, as the compiler writes its own. A hold before the window lasts until it opens, as WebKit drops frozen values.
  const hold = (to: string | undefined, begin = "0s", dur = HOLD) =>
    `<set attributeName="${name}" to="${to}" begin="${begin}" dur="${num(dur)}s" fill="freeze"/>`;

  const from = (begin: string) => tag.replace(/(\sbegin=")[^"]*/, `$1${begin}`);

  if (paused) {
    if (clock <= start) return hold(first);
    const begin = HOLD - Math.max(Math.min(clock - start, length), HOLD);

    return from(`${num(begin)}s`).replace(/\/>$/, ` end="${num(HOLD)}s"/>`);
  }

  const over = clock >= start + length;
  const begin = `${num(start - clock + (over ? loop : 0))}s;${id}.begin+${num(loop)}s`;
  // The compiler's reset for the loops after the first, when the window leaves a different value behind.
  const again = /\sbegin="[^"]*;([^"]*\.begin\+[^"]*)"/.exec(sets)?.[1];

  return (
    (over ? hold(last) : "") +
    from(begin) +
    (clock < start ? hold(first, "0s", start - clock) : "") +
    (again === undefined ? "" : hold(first, again, start))
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
