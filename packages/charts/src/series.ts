import type { AreaOptions, BarsOptions, Datum, LineOptions, Series } from "./types.ts";

export const bars = (
  data: Readonly<Record<string, number>> | readonly Datum<string>[],
  options: BarsOptions,
): Series => ({
  kind: "bars",
  data: Array.isArray(data) ? data : Object.entries(data),
  options: { name: "bars", ...options },
});

export const line = (data: readonly Datum[], options: LineOptions): Series => ({
  kind: "line",
  data,
  options: { name: "line", ...options },
});

export const area = (data: readonly Datum[], options: AreaOptions): Series => ({
  kind: "area",
  data,
  options: { name: "area", ...options },
});
