export type Point = { readonly x: number; readonly y: number };

export interface Size {
  readonly w: number;
  readonly h: number;
}

export interface Box extends Point, Size {}

/** Rank axis down the page (`TB`) or across it (`LR`). */
export type Direction = "TB" | "LR";
