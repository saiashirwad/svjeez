// Two scenes side by side in one SVG, both still animating and on the same clock: main's copy and this branch's.
import { nest, render } from "svjeez";

const PAD = 16;
const GAP = 16;
const LABEL = 28;

const CSS = `
.reel-bg{fill:#f4f4f5}.reel-label{font:600 13px ui-sans-serif,system-ui,sans-serif;fill:#52525b}
@media (prefers-color-scheme:dark){.reel-bg{fill:#18181b}.reel-label{fill:#a1a1aa}}`;

const size = (svg: string) => {
  const box = /viewBox="([^"]+)"/.exec(svg)?.[1]?.split(/\s+/).map(Number) ?? [];

  return { width: box[2] ?? 0, height: box[3] ?? 0 };
};

const duration = (svg: string) =>
  Number(/\.\w*a\{animation-duration:([\d.]+)s/.exec(svg)?.[1] ?? 1);

export interface CompareOptions {
  readonly title: string;
  readonly labels?: readonly [string, string];
  /** Drawn width of each scene. Default: the wider scene's own width. */
  readonly width?: number;
}

/** `before` and `after` must be rendered with distinct prefixes, as `renderAs()` does. */
export const compare = (
  before: string,
  after: string,
  { title, labels = ["main", "this branch"], width }: CompareOptions,
) => {
  const a = size(before);
  const b = size(after);
  const w = width ?? Math.max(a.width, b.width);
  const h = Math.max((w * a.height) / a.width, (w * b.height) / b.width);
  const total = { width: PAD * 2 + w * 2 + GAP, height: PAD * 2 + LABEL + h };
  const columns = [
    { svg: before, x: PAD, label: labels[0] },
    { svg: after, x: PAD + w + GAP, label: labels[1] },
  ];

  return render(
    {
      ...total,
      // The scenes keep their own clocks, so the reel only needs one loop of the longer.
      duration: Math.max(duration(before), duration(after)),
      title,
      desc: `${labels[0]} on the left, ${labels[1]} on the right, playing in sync.`,
      css: CSS,
      prefix: "r",
      reducedMotion: false,
    },
    <>
      <rect class="reel-bg" width={total.width} height={total.height} rx={12} />
      {columns.map(({ svg, x, label }) => (
        <>
          <text class="reel-label" x={x} y={PAD + 14}>
            {label}
          </text>
          {nest(svg, { x, y: PAD + LABEL, width: w })}
        </>
      ))}
    </>,
  );
};
