import type { Point } from "svjeez";

export interface Place {
  readonly name: string;
  readonly at: Point;
  readonly side?: "left" | "right" | "above" | "below";
  readonly kind?: "town" | "tower" | "port";
}

export const PLACES = {
  bramblecott: { name: "Bramblecott", at: { x: 236, y: 290 }, side: "below" },
  ford: { name: "Ford of Glass", at: { x: 333, y: 360 }, side: "left" },
  elder: { name: "Elderhall", at: { x: 452, y: 402 }, side: "below" },
  pass: { name: "Gate of Teeth", at: { x: 590, y: 352 }, side: "above", kind: "tower" },
  ashfall: { name: "Ashfall", at: { x: 690, y: 400 }, side: "below", kind: "tower" },
  westhaven: { name: "Westhaven", at: { x: 160, y: 352 }, side: "below", kind: "port" },
  northmark: { name: "Northmark", at: { x: 470, y: 176 }, side: "above" },
  gull: { name: "Gullreach", at: { x: 700, y: 486 }, side: "right", kind: "port" },
} as const satisfies Record<string, Place>;

/** Mount Cinder, where the road ends. */
export const CINDER: Point = { x: 772, y: 336 };
