import scene from "@examples/site/hero.tsx";
import cue from "@examples/site/cue.tsx";
import introCue from "@examples/site/intro-cue.tsx";
import examplesCue from "@examples/site/examples-cue.tsx";
import { live } from "./live";
import { facts, kb } from "./proof";

// Main-thread milliseconds per second the scene costs while it plays, measured in headless Chromium at 1056px wide.
const COST = 60;

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
