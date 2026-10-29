import { clamp } from "../util";
import type { Genome } from "./genome";

/** What a genome's oid and dimension mean for how a specimen is built and drawn. */
export interface Form {
  /** How far along toward each oid, 0 for a cat. Oidness under 0.15 is still a cat. */
  readonly dog: number;
  readonly horse: number;
  readonly loaf: number;
  /** The longer of the dog's and the horse's snout. */
  readonly snout: number;
  /** A top hat's height in head radii, 0 without one. */
  readonly hat: number;
  /** Multipliers on the lengths of legs and tails, from the unramped oidness. */
  readonly legGrowth: number;
  readonly legShrink: number;
  readonly tailGrowth: number;
  /** The coat turns to bread. */
  readonly bread: boolean;
  readonly floppy: boolean;
  /** The head is a rounded box. */
  readonly boxy: boolean;
  readonly snouted: boolean;
  readonly maned: boolean;
  /** Paws turn dark. */
  readonly hoofed: boolean;
  readonly liquid: boolean;
  readonly four: boolean;
}

export const form = (g: Genome): Form => {
  const k = clamp((g.oidness - 0.15) / 0.85, 0, 1);
  const dog = g.oid === "dog" ? k : 0;
  const horse = g.oid === "horse" ? k : 0;
  const loaf = g.oid === "loaf" ? k : 0;
  const snout = Math.max(dog, horse);
  const rawHorse = g.oid === "horse" ? g.oidness : 0;
  const rawLoaf = g.oid === "loaf" ? g.oidness : 0;

  return {
    dog,
    horse,
    loaf,
    snout,
    hat: g.oid === "hat" ? 0.9 + 1.6 * g.oidness : 0,
    legGrowth: 1 + rawHorse * 0.8,
    legShrink: 1 - rawLoaf * 0.65,
    tailGrowth: 1 + rawHorse * 0.3,
    bread: g.oid === "loaf" && g.oidness > 0.5,
    floppy: dog > 0.5,
    boxy: loaf > 0.5,
    snouted: snout > 0.3,
    maned: horse > 0.4,
    hoofed: horse > 0.5,
    liquid: g.dimension === "liquid",
    four: g.dimension === "4d",
  };
};
