import { describe, expect, test } from "bun:test";
import { motion, render } from "svjeez";

describe("playbackRate", () => {
  const durations = (svg: string) =>
    [...svg.matchAll(/(?:animation-duration:|animation-delay:-|dur=")([\d.,s]+)/g)].flatMap((m) =>
      m[1]!.split(",").map(parseFloat),
    );

  test("playbackRate divides every emitted duration and keeps the timeline", () => {
    const scene = (playbackRate: number) =>
      render(
        {
          width: 100,
          height: 100,
          duration: 6,
          title: "Speed",
          playbackRate,
          reducedMotion: { at: 3 },
        },
        <>
          <rect
            width={10}
            height={10}
            animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1)}
          />
          <circle r={4} animation={motion({ rotate: 0 }).to({ rotate: 90 }, 1).loop(4)} />
          <path
            d="M0 0H10"
            stroke="#fff"
            animation={motion({ blur: 0 }).at(2).to({ blur: 4 }, 1)}
          />
        </>,
      );

    const [normal, fast] = [scene(1), scene(2)];
    expect(durations(normal).sort()).toEqual([3, 3, 6, 6]);
    expect(durations(fast)).toEqual(durations(normal).map((d) => d / 2));
    expect(fast.replace(/(?:animation-duration:|animation-delay:-|dur=")[\d.,s]+/g, "")).toBe(
      normal.replace(/(?:animation-duration:|animation-delay:-|dur=")[\d.,s]+/g, ""),
    );
  });
});
