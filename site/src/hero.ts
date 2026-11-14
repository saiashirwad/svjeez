// The hero scene, compiled at build time: its size is what the headline states, so it describes the file on screen.
import scene from "@examples/site/hero.tsx";
import cue from "@examples/site/cue.tsx";
import introCue from "@examples/site/intro-cue.tsx";
import { live } from "./live";
import { facts, kb } from "./proof";

// Main-thread milliseconds per second the scene costs while it plays, measured in headless Chromium at 1056px wide.
const COST = 60;

/** The hero as the page's `LiveScene` takes it. */
export const heroImage = live(scene);

/** The file's facts, for the page's tally. */
export const heroFile = facts(heroImage);

export const hero = {
  /** Gzipped size, as the headline states it. */
  size: kb(heroImage.gzip),
  src: heroImage.src,
  alt: heroImage.desc || heroImage.title,
  cost: COST,
};

/** "play with svjeez", handwritten with the chick playing under it, on the way down to the editor. */
export const cueImage = live(cue);

/** "watch the intro", handwritten with the chick playing projector, on the way to the intro reel. */
export const introCueImage = live(introCue);
