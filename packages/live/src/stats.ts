// What a readout under the picture says about the file the newest compile made, as labelled values.
import type { Stats } from "./editor.ts";

export interface Stat {
  readonly value: string;
  readonly label: string;
}

/** Bytes as the readout writes them: whole bytes under a kilobyte, then one decimal under ten, then none. */
export const sizeOf = (bytes: number): string =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`;

/** The gzipped size, the keyframes, the script and, once a compile has run, how long it took. */
export const statsOf = (stats: Stats): Stat[] => [
  { value: sizeOf(stats.gzip), label: "gzip" },
  { value: String(stats.keyframes), label: stats.keyframes === 1 ? "keyframe" : "keyframes" },
  { value: sizeOf(stats.scriptBytes), label: "JS" },
  ...(stats.ms === null ? [] : [{ value: `${stats.ms.toFixed(1)} ms`, label: "to build" }]),
];
