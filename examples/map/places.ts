import type { Point } from "svjeez";
import { Y } from "./kit";

export interface Place {
  readonly name: string;
  readonly at: Point;
  readonly side?: "left" | "right" | "above" | "below";
  readonly kind?: "town" | "tower" | "port";
}

export const PLACES = {
  bramblecott: { name: "Bramblecott", at: { x: 236, y: Y(290) }, side: "below" },
  ford: { name: "Ford of Glass", at: { x: 333, y: Y(360) }, side: "left" },
  elder: { name: "Elderhall", at: { x: 452, y: Y(402) }, side: "below" },
  pass: { name: "Gate of Teeth", at: { x: 590, y: Y(352) }, side: "above", kind: "tower" },
  ashfall: { name: "Ashfall", at: { x: 690, y: Y(400) }, side: "below", kind: "tower" },
  westhaven: { name: "Westhaven", at: { x: 160, y: Y(352) }, side: "below", kind: "port" },
  northmark: { name: "Northmark", at: { x: 470, y: Y(176) }, side: "above" },
  gull: { name: "Gullreach", at: { x: 700, y: Y(486) }, side: "right", kind: "port" },
} as const satisfies Record<string, Place>;

export const CINDER: Point = { x: 772, y: Y(336) };
