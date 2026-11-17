import { clamp } from "../util";
import type { Genome } from "./genome";

export interface Form {
  readonly dog: number;
  readonly horse: number;
  readonly loaf: number;
  readonly snout: number;
  readonly hat: number;
  readonly legGrowth: number;
  readonly legShrink: number;
  readonly tailGrowth: number;
  readonly bread: boolean;
  readonly floppy: boolean;
  readonly boxy: boolean;
  readonly snouted: boolean;
  readonly maned: boolean;
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
