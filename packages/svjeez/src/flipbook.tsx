import { motion, type Seconds } from "./motion";
import { Picture, type PictureData } from "./picture";
import type { SvgNode } from "./svg";

export interface FlipbookFrame {
  /** When the frame first shows, in scene seconds. */
  readonly at: Seconds;
  readonly src: PictureData;
}

export interface FlipbookProps {
  /** In time order. Each shows from its `at` until the next frame's. */
  readonly frames: readonly FlipbookFrame[];
  /** The scene's `duration`. The last frame holds until then, and the first comes back as the loop restarts. */
  readonly duration: Seconds;
  readonly x?: number;
  readonly y?: number;
  /** One given derives the other from the first frame; none uses its intrinsic size. */
  readonly width?: number;
  readonly height?: number;
  readonly alt?: string;
}

/**
 * Raster frames played back on the scene's timeline, such as a screen recording. Every frame is a picture that cuts in
 * at its time and out at the next, so the file pays for each distinct frame once.
 */
export function Flipbook({
  frames,
  duration,
  x = 0,
  y = 0,
  width,
  height,
  alt,
}: FlipbookProps): SvgNode {
  const first = frames[0];

  if (!first) throw new Error("<Flipbook> needs at least one frame.");

  frames.forEach((frame, i) => {
    if (i > 0 && !(frame.at > frames[i - 1]!.at))
      throw new Error(
        `<Flipbook> frames must be in time order, got ${frame.at}s after ${frames[i - 1]!.at}s.`,
      );

    if (frame.at >= duration)
      throw new Error(`<Flipbook> frame at ${frame.at}s falls outside a ${duration}s scene.`);
  });

  const w =
    width ??
    (height === undefined ? first.src.width : (height * first.src.width) / first.src.height);

  const h = height ?? (w * first.src.height) / first.src.width;

  return (
    <g
      role={alt === undefined ? undefined : "img"}
      aria-label={alt}
      aria-hidden={alt === undefined ? "true" : undefined}
    >
      {frames.map((frame, i) => {
        const end = frames[i + 1]?.at ?? duration;

        const shown =
          i === 0
            ? motion({ opacity: 1 })
            : motion({ opacity: 0 }).at(frame.at).set({ opacity: 1 });

        return (
          <g animation={end < duration ? shown.at(end).set({ opacity: 0 }) : shown}>
            <Picture src={frame.src} x={x} y={y} width={w} height={h} fit="fill" />
          </g>
        );
      })}
    </g>
  );
}
