import { REDUCED_MOTION } from "./svg/css";
import { num } from "./model/format";
import type { Seconds } from "./model/time";
import { rateOf } from "./svg/rate";
import type { Theme } from "./author/values";

export interface RestyleOptions {
  readonly css?: string;
  /** New light and dark values for the scene's tokens, by name, as tokens() makes them. Mixes of them follow. */
  readonly theme?: Theme;
  /** Answers the SVG's prefers-color-scheme queries for this scheme, so it shows it in any browser whatever the viewer's. */
  readonly scheme?: "light" | "dark";
  readonly at?: Seconds;
  readonly paused?: boolean;
  readonly still?: boolean;
  readonly timeline?: string;
  readonly range?: string;
}

const PAUSE = "*{animation-play-state:paused!important}";

const HOLD = 0.001;

const activeDuration = (tag: string): Seconds => {
  const dur = parseFloat(/\sdur="([\d.]+)s"/.exec(tag)?.[1] ?? "");
  const repeats = parseFloat(/\srepeatCount="([\d.]+)"/.exec(tag)?.[1] ?? "");

  return dur * repeats || Infinity;
};

const WINDOWED =
  /(<animate\b[^>]*\sdata-loop="[^"]*"[^>]*\/>)((?:\s*<set\b[^>]*\sdata-loop="[^"]*"[^>]*\/>)*)/g;

const attr = (tag: string, name: string): string =>
  new RegExp(`\\s${name}="([^"]*)"`).exec(tag)?.[1] ?? "";

const windowedAt = (tag: string, sets: string, clock: Seconds, paused?: boolean) => {
  const loop = parseFloat(attr(tag, "data-loop"));
  const start = parseFloat(attr(tag, "begin"));
  const length = parseFloat(attr(tag, "dur"));
  const id = attr(tag, "id");
  const name = attr(tag, "attributeName");
  const [first, ...rest] = attr(tag, "values").split(";");
  const last = rest.at(-1);

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
  const again = /\sbegin="[^"]*;([^"]*\.begin\+[^"]*)"/.exec(sets)?.[1];

  return (
    (over ? hold(last) : "") +
    from(begin) +
    (clock < start ? hold(first, "0s", start - clock) : "") +
    (again === undefined ? "" : hold(first, again, start))
  );
};

const escaped = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const timelineCss = (svg: string, timeline: string, range: string | undefined): string => {
  if (!/^(--[\w-]+|[a-z-]+\(.*\))$/.test(timeline))
    throw new Error(
      `restyle() needs a timeline that is a dashed name such as "--story" or a function such as "view()", got ${JSON.stringify(timeline)}.`,
    );

  if (/<animate\b/.test(svg))
    throw new Error(
      "restyle() can't put this scene on a timeline: it morphs, resizes a geometry or animates an effect, which only play on the clock. Call seek() from svjeez/page on scroll instead.",
    );

  const root = /^<svg\b[^>]*\sclass="([^"]*)root"/.exec(svg)?.[1] ?? "";
  const prefix = escaped(root);
  const base = new RegExp(`\\.${prefix}a\\{animation-duration:([\\d.]+)s`).exec(svg);

  if (!base) return "";

  const loop = parseFloat(base[1]!);
  const rules: string[] = [];

  const own = new RegExp(
    `\\.(${prefix}(?:[\\w-]+-)?m\\d+)\\{[^{}]*?animation-duration:([\\d.,s]+)`,
    "g",
  );

  for (const [, name, durations] of svg.matchAll(own))
    rules.push(
      `.${name}{animation-iteration-count:${durations!
        .split(",")
        .map((one) => parseFloat(one))
        .map((d) => num(loop / d))
        .join(",")}}`,
    );

  const rangeRule = range === undefined ? "" : `;animation-range:${range}`;
  const head = `.${root}a{animation-timeline:${timeline};animation-delay:0s;animation-iteration-count:1${rangeRule}}`;

  return `@supports (animation-timeline:scroll()){@media (prefers-reduced-motion:no-preference){${head}${rules.join("")}}}`;
};

const themeCss = (svg: string, theme: Theme): string => {
  const prefix = /^<svg\b[^>]*\sclass="([^"]*)root"/.exec(svg)?.[1];
  const scope = prefix ? `svg.${prefix}root` : "svg";

  const declared = (scheme: "light" | "dark") =>
    Object.values(theme)
      .map((token) => `--${token.name}:${token[scheme]}`)
      .join(";");

  return `${scope}{${declared("dark")}}@media (prefers-color-scheme:light){${scope}{${declared("light")}}}`;
};

const pinned = (svg: string, scheme: "light" | "dark"): string =>
  svg.replace(/\(\s*prefers-color-scheme\s*:\s*(light|dark)\s*\)/g, (_, query: string) =>
    query === scheme ? "(min-width: 0)" : "(max-width: -1px)",
  );

export const restyle = (
  svg: string,
  { css, theme, scheme, at, paused, still, timeline, range }: RestyleOptions,
): string => {
  if (at !== undefined && !(Number.isFinite(at) && at >= 0))
    throw new Error(`restyle() needs at of 0 or more, got ${at}.`);

  let out = svg;
  const rate = rateOf(svg);

  const extra = [
    theme && themeCss(svg, theme),
    css,
    (still || paused) && PAUSE,
    timeline !== undefined && timelineCss(svg, timeline, range),
  ]
    .filter(Boolean)
    .join("\n");

  if (still) out = out.replaceAll(REDUCED_MOTION, "@media all{");
  else if (at || paused) {
    const loop = (at ?? 0) / rate;
    const clocks = `--t0:-${num(loop)}s`;
    out = out.replace(/<svg\b[^>]*>/, (root) =>
      /\sstyle="/.test(root)
        ? root.replace(/\sstyle="/, `$&${clocks};`)
        : root.replace(/\s*\/?>$/, ` style="${clocks}"$&`),
    );
    out = out.replace(WINDOWED, (_, tag: string, sets: string) =>
      windowedAt(tag, sets, loop % (parseFloat(attr(tag, "data-loop")) || Infinity), paused),
    );
    out = out.replace(/<animate\b(?![^>]*\sbegin=)[^>]*>/g, (tag) => {
      const runs = activeDuration(tag);

      const begin = paused
        ? HOLD - Math.max(Math.min(loop, runs), HOLD)
        : -Math.min(loop, runs - HOLD);

      const hold = paused
        ? ` end="${num(HOLD)}s"${/\sfill=/.test(tag) ? "" : ' fill="freeze"'}`
        : "";

      return tag.replace(/^<animate\b/, `<animate begin="${num(begin)}s"${hold}`);
    });

    if (paused) out = out.replaceAll(REDUCED_MOTION, "@media not all{");
  }

  if (extra) {
    const close = out.lastIndexOf("</svg>");
    out = `${out.slice(0, close)}<style>${extra}</style>${out.slice(close)}`;
  }

  return scheme === undefined ? out : pinned(out, scheme);
};
