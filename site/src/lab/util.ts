import type { Ease } from "svjeez";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The control points of a bezier ease. A param of its own kind holds any ease, so any other kind reads as linear. */
export const easePoints = (e: Ease): readonly [number, number, number, number] =>
  e.kind === "bezier" ? e.points : [0, 0, 1, 1];

/** A value built on first use, then kept. */
export const lazy = <T>(make: () => T): (() => T) => {
  let value: T | undefined;

  return () => (value ??= make());
};

/** An object URL for an SVG file. The caller revokes it. */
export const svgUrl = (svg: string) =>
  URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
