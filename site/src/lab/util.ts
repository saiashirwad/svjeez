import type { Ease } from "svjeez";

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const easePoints = (e: Ease): readonly [number, number, number, number] =>
  e.kind === "bezier" ? e.points : [0, 0, 1, 1];

export const lazy = <T>(make: () => T): (() => T) => {
  let value: T | undefined;

  return () => (value ??= make());
};

export const svgUrl = (svg: string) =>
  URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));

export const gzipSize = async (text: string): Promise<number> => {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));

  return (await new Response(stream).arrayBuffer()).byteLength;
};
