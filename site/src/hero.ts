import scene from "./scenes/hero";
import cue from "./scenes/cue";
import introCue from "./scenes/intro-cue";
import examplesCue from "./scenes/examples-cue";
import { live } from "./live";
import { facts, kb } from "./proof";

// Main-thread milliseconds per second the scene costs while it plays, measured in headless Chromium at 1056px wide.
const COST = 60;

// The hero draws its own windows, at the size the page lays it out for.
export const heroImage = live(scene);

export const heroFile = facts(heroImage);

export const hero = {
  size: kb(heroImage.gzip),
  src: heroImage.src,
  alt: heroImage.desc || heroImage.title,
  cost: COST,
};

export const cueImage = live(cue);

export const introCueImage = live(introCue);

export const examplesCueImage = live(examplesCue);
