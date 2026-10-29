export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** An object URL for an SVG file. The caller revokes it. */
export const svgUrl = (svg: string) =>
  URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
