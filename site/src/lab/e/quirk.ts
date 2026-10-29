import type { Genome, Quirk } from "./genome";

/** When in the loop the odd thing happens, in seconds. */
export const QUIRK_AT = { at: 4.6, spin: 4.7, hatLift: 6.1, back: 6.9 };

export interface QuirkFit {
  /** The specimen turns all the way round, so it needs the circle its box sweeps. */
  readonly sweep: boolean;
  /** Room taken out of the frame, in px, and how far the specimen sits below the middle. */
  readonly trimX: number;
  readonly trimY: number;
  readonly dropY: number;
}

const NONE: QuirkFit = { sweep: false, trimX: 0, trimY: 0, dropY: 0 };

/** The word the specimen says, and the room the odd thing needs in the frame. */
export const QUIRK: Record<Quirk, { readonly word: string; readonly fit: (g: Genome) => QuirkFit }> = {
  spin: { word: "wheee", fit: (g) => ({ ...NONE, sweep: g.heads === 0 }) },
  wrap: { word: "brb", fit: () => NONE },
  split: { word: "mitosis", fit: () => ({ ...NONE, trimX: 84 }) },
  hat: { word: "?", fit: () => NONE },
  float: { word: "hup", fit: () => ({ sweep: true, trimX: 0, trimY: 30, dropY: 15 }) },
  none: { word: "", fit: () => NONE },
};
