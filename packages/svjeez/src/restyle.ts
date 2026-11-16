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
  /**
   * Scrub the scene with a scroll or view timeline instead of playing it on the clock: a dashed ident the page declares
   * (`"--story"`, with `view-timeline-name` or `scroll-timeline-name`), or a timeline function (`"view()"`, `"scroll(root)"`). A function timeline is made per element, so `view()` gives every part its own range: use a name for a shared one.
   * The whole loop spans the timeline's range once. CSS animations follow it; browsers without `animation-timeline` and
   * viewers who ask for reduced motion keep what the scene does without it. `at`, `onceAt` and `paused` have no effect
   * on what follows the timeline, and a `<Once>` part with a duration shorter than the loop spreads over the whole range.
   *
   * Parts inside `<Ambient>` stay on the clock: they keep their durations, loops and delays, so they play on while the
   * page stands still, and `at` and `paused` still apply to them. `seek()` and `frames` know nothing of the split and
   * set every animation to one scene time.
   *
   * SMIL cannot follow a timeline, so a scene with `<animate>` outside `<Ambient>` throws: drive it with `seek()` instead.
   */
  readonly timeline?: string;
  /** The `animation-range` the timeline's scene spans, such as `"contain"` for a tall section holding a sticky scene. Default the timeline's whole range. */
  readonly range?: string;
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

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The seconds in a comma list of `s` durations. */
const secondsOf = (list: string): number[] => list.split(",").map((one) => parseFloat(one));

/**
 * CSS that makes every animation of the scene run once over a timeline. The timeline stretches an animation's whole run
 * over its range, so each rule's time durations stay as the weights they are and a finite count of loop / duration makes
 * every one end with the loop.
 */
const timelineCss = (svg: string, timeline: string, range: string | undefined): string => {
  if (!/^(--[\w-]+|[a-z-]+\(.*\))$/.test(timeline))
    throw new Error(
      `restyle() needs a timeline that is a dashed name such as "--story" or a function such as "view()", got ${JSON.stringify(timeline)}.`,
    );

  if (/<animate\b(?![^>]*\sdata-ambient=)/.test(svg))
    throw new Error(
      "restyle() cannot make SMIL follow a timeline, and this scene has <animate> outside <Ambient>. Call seek() from svjeez/page on scroll instead.",
    );

  const root = /^<svg\b[^>]*\sclass="([^"]*)root"/.exec(svg)?.[1] ?? "";
  const prefix = escaped(root);
  const base = new RegExp(`\\.${prefix}a\\{animation-duration:([\\d.]+)s`).exec(svg);

  if (!base) return "";

  const loop = parseFloat(base[1]!);
  // Parts inside <Ambient> carry this class and keep the clock, so no rule here may reach them.
  const scrubbed = `:not(.${root}c)`;
  const rules: string[] = [];

  const own = new RegExp(
    `\\.(${prefix}(?:[\\w-]+-)?m\\d+)\\{[^{}]*?animation-duration:([\\d.,s]+)`,
    "g",
  );

  for (const [, name, durations] of svg.matchAll(own))
    rules.push(
      `.${name}${scrubbed}{animation-iteration-count:${secondsOf(durations!)
        .map((d) => num(loop / d))
        .join(",")}}`,
    );

  const rangeRule = range === undefined ? "" : `;animation-range:${range}`;
  const head = `.${root}a${scrubbed}{animation-timeline:${timeline};animation-delay:0s;animation-iteration-count:1${rangeRule}}`;

  const once = svg.includes(`.${root}o{`)
    ? `.${root}o${scrubbed}{animation-delay:0s;animation-iteration-count:1}`
    : "";

  return `@supports (animation-timeline:scroll()){@media (prefers-reduced-motion:no-preference){${head}${rules.join("")}${once}}}`;
};

/** A copy of a rendered SVG with more CSS, started or held `at` seconds in, or held at its still frame. A page uses it to recolor or pause an `<img>` without restarting it. */
export const restyle = (
  svg: string,
  { css, at, onceAt, paused, still, timeline, range }: RestyleOptions,
): string => {
  for (const [name, value] of [
    ["at", at],
    ["onceAt", onceAt],
  ] as const)
    if (value !== undefined && !(Number.isFinite(value) && value >= 0))
      throw new Error(`restyle() needs ${name} of 0 or more, got ${value}.`);

  let out = svg;
  const rate = rateOf(svg);

  const extra = [
    css,
    (still || paused) && PAUSE,
    timeline !== undefined && timelineCss(svg, timeline, range),
  ]
    .filter(Boolean)
    .join("\n");

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
