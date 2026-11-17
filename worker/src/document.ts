import type { Json } from "svjeez/params";

/** One slide: a kind of block (a key of `kinds` in slides.tsx) and that block's own values. */
export interface DeckSlide {
  readonly id: string;
  readonly kind: string;
  readonly values: Json;
}

/** A deck the session agent edits: a title and its slides in order. */
export interface Deck {
  readonly title: string;
  readonly slides: readonly DeckSlide[];
}

export const EMPTY: Deck = { title: "Untitled deck", slides: [] };

/** A turn's bounds: model calls (steps) in one turn, slides in a deck, model calls in a session, and wall time. */
export const LIMITS = { steps: 40, slides: 30, calls: 200, ms: 5 * 60_000 } as const;
