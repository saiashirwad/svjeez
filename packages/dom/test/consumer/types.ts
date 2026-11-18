import { browser, cssEase, loop, snap, snapshots, type Anim, type Step } from "@svjeez/dom";
import { click, demo as reactDemo } from "@svjeez/dom/react";
import { given, message, story } from "@svjeez/dom/story";
import { demo as svelteDemo } from "@svjeez/dom/svelte";
import { recordings } from "@svjeez/dom/vite";

export const used = [
  browser,
  cssEase,
  loop,
  snap,
  snapshots,
  click,
  reactDemo,
  given,
  message,
  story,
  svelteDemo,
  recordings,
];

export type Steps = Step[];

export type Anims = Anim[];
