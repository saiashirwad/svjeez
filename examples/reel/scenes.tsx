// The reels themselves: a wipe between two stills with the changed regions boxed, and a flipbook that plays two films
// of the same scroll side by side. Screenshots embed as JPEG through <Picture>, so each reel is still one file.
import { Picture, def, draw, ease, motion, picture, render, type Motion } from "svjeez";
import type { Box, Frame } from "./capture";

const PAD = 16;
const LABEL = 28;

const CSS = `
.reel-bg{fill:#f4f4f5}.reel-label{font:600 13px ui-sans-serif,system-ui,sans-serif;fill:#52525b}
.reel-chip{fill:#18181b}.reel-chip-text{font:600 12px ui-sans-serif,system-ui,sans-serif;fill:#fff}
.reel-frame{fill:none;stroke:#d4d4d8}.reel-box{fill:none;stroke:#e11d48;stroke-width:2.5}
.reel-bar{fill:#e4e4e7}.reel-progress{fill:#e11d48}
@media (prefers-color-scheme:dark){.reel-bg{fill:#18181b}.reel-label{fill:#a1a1aa}.reel-frame{stroke:#3f3f46}.reel-bar{fill:#27272a}}`;

const chip = (x: number, y: number, label: string, animation?: Motion<"opacity">) => (
  <g animation={animation}>
    <rect class="reel-chip" x={x} y={y} width={label.length * 7.4 + 18} height={22} rx={11} />
    <text class="reel-chip-text" x={x + 9} y={y + 15}>
      {label}
    </text>
  </g>
);

export interface WipeOptions {
  readonly title: string;
  readonly before: Uint8Array;
  readonly after: Uint8Array;
  /** In the screenshots' pixels. */
  readonly boxes: readonly Box[];
  /** Drawn width of the screenshot. */
  readonly width: number;
}

// Beats, in seconds.
const HOLD = 0.9;
const WIPE = 1.2;
const SHOW = 2.6;
const T = {
  in: HOLD,
  boxes: HOLD + WIPE,
  out: HOLD + WIPE + SHOW,
  end: 2 * HOLD + 2 * WIPE + SHOW,
};

/** Before, then a divider sweeps across to reveal after, boxes draw round what changed, and it sweeps back. */
export const wipe = ({ title, before, after, boxes, width }: WipeOptions) => {
  const a = picture(before);
  const b = picture(after);
  const k = width / a.width;
  const height = a.height * k;
  const x0 = PAD;
  const y0 = PAD + LABEL;
  const grow = motion({ width: 0 })
    .at(T.in)
    .to({ width }, WIPE, ease.inOut)
    .at(T.out)
    .to({ width: 0 }, WIPE, ease.inOut);
  const slide = motion({ x: 0 })
    .at(T.in)
    .to({ x: width }, WIPE, ease.inOut)
    .at(T.out)
    .to({ x: 0 }, WIPE, ease.inOut);
  const reveal = def.clipPath(
    {},
    <rect x={x0} y={y0} width={0} height={height} animation={grow} />,
  );
  const total = { width: width + PAD * 2, height: height + PAD * 2 + LABEL };

  return render(
    {
      ...total,
      duration: T.end,
      title,
      desc: `Before and after, with ${boxes.length} changed regions boxed.`,
      css: CSS,
      prefix: "w",
      reducedMotion: { at: T.boxes + 1 },
    },
    <>
      <rect class="reel-bg" width={total.width} height={total.height} rx={12} />
      <text class="reel-label" x={x0} y={PAD + 14}>
        {title}
      </text>
      <Picture src={a} x={x0} y={y0} width={width} height={height} alt="Before" />
      <g clipPath={reveal}>
        <Picture src={b} x={x0} y={y0} width={width} height={height} alt="After" />
      </g>
      <rect class="reel-frame" x={x0} y={y0} width={width} height={height} />
      {boxes.map((box, i) => (
        <rect
          class="reel-box"
          x={x0 + box.x * k - 3}
          y={y0 + box.y * k - 3}
          width={box.width * k + 6}
          height={box.height * k + 6}
          rx={6}
          animation={[
            draw({ at: T.boxes + i * 0.12, over: 0.5 }),
            motion({ opacity: 1 })
              .at(T.out - 0.3)
              .to({ opacity: 0 }, 0.3)
              .at(T.end - 0.01)
              .set({ opacity: 1 }),
          ]}
        />
      ))}
      <line
        x1={x0}
        y1={y0}
        x2={x0}
        y2={y0 + height}
        stroke="#e11d48"
        strokeWidth={2}
        animation={[
          slide,
          motion({ opacity: 0 })
            .at(T.in)
            .set({ opacity: 1 })
            .at(T.in + WIPE)
            .set({ opacity: 0 })
            .at(T.out)
            .set({ opacity: 1 })
            .at(T.out + WIPE)
            .set({ opacity: 0 }),
        ]}
      />
      {chip(
        x0 + 12,
        y0 + 12,
        "Before",
        motion({ opacity: 1 })
          .at(T.in + WIPE / 2)
          .to({ opacity: 0 }, 0.2)
          .at(T.out + WIPE / 2)
          .to({ opacity: 1 }, 0.2),
      )}
      {chip(
        x0 + width - 70,
        y0 + 12,
        "After",
        motion({ opacity: 0 })
          .at(T.in + WIPE / 2)
          .to({ opacity: 1 }, 0.2)
          .at(T.out + WIPE / 2)
          .to({ opacity: 0 }, 0.2),
      )}
    </>,
  );
};

export interface FlipbookOptions {
  readonly title: string;
  readonly films: readonly { readonly label: string; readonly frames: readonly Frame[] }[];
  /** Seconds of film. */
  readonly length: number;
  /** Drawn width of each film. */
  readonly width: number;
  /** Seconds to rest on the last frame before the loop restarts. */
  readonly rest?: number;
}

/** Films side by side on one clock. Each frame is a picture that shows from its time until the next frame's. */
export const flipbook = ({ title, films, length, width, rest = 1 }: FlipbookOptions) => {
  const first = picture(films[0]!.frames[0]!.jpeg);
  const k = width / first.width;
  const height = first.height * k;
  const duration = length + rest;
  const total = {
    width: PAD * 2 + films.length * width + (films.length - 1) * PAD,
    height: PAD * 2 + LABEL + height + 14,
  };

  return render(
    {
      ...total,
      duration,
      title,
      desc: `${films.map((f) => f.label).join(" and ")}, filmed through the same scroll.`,
      css: CSS,
      prefix: "f",
      reducedMotion: { at: length },
    },
    <>
      <rect class="reel-bg" width={total.width} height={total.height} rx={12} />
      {films.map(({ label, frames }, column) => {
        const x = PAD + column * (width + PAD);
        const y = PAD + LABEL;

        return (
          <>
            <text class="reel-label" x={x} y={PAD + 14}>
              {label}
            </text>
            {frames.map((frame, i) => {
              // Each frame shows from its time to the next frame's; the last holds to the end of the loop.
              const from =
                i === 0
                  ? motion({ opacity: 1 })
                  : motion({ opacity: 0 }).at(frame.t).set({ opacity: 1 });
              const shown = from.at(frames[i + 1]?.t ?? duration - 0.01).set({ opacity: 0 });

              return (
                <g animation={shown}>
                  <Picture src={picture(frame.jpeg)} x={x} y={y} width={width} height={height} />
                </g>
              );
            })}
            <rect class="reel-frame" x={x} y={y} width={width} height={height} />
            <rect class="reel-bar" x={x} y={y + height + 8} width={width} height={3} rx={1.5} />
            <rect
              class="reel-progress"
              x={x}
              y={y + height + 8}
              width={0}
              height={3}
              rx={1.5}
              animation={motion({ width: 0 }).to({ width }, length, ease.linear)}
            />
          </>
        );
      })}
    </>,
  );
};
