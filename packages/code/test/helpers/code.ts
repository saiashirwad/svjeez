import type { highlight } from "../../src/index.ts";

export const flat = (lines: ReturnType<typeof highlight>) =>
  lines.map((line) => line.map((p) => (Array.isArray(p) ? p[1] : p)).join(""));
