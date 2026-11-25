import scene from "./scenes/hero";
import cue from "./scenes/cue";
import introCue from "./scenes/intro-cue";
import examplesCue from "./scenes/examples-cue";
import { live } from "./live";
import { facts, kb } from "./proof";

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
