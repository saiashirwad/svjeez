// Type-checks the published declarations of every entry point, without skipLibCheck.
import { browser, Dom, duration, snap, snapshots, type Step } from "@svjeez/dom";
import { fidelity } from "@svjeez/dom/fidelity";
import { click, demo as reactDemo } from "@svjeez/dom/react";
import { given, message, story } from "@svjeez/dom/story";
import { demo as svelteDemo } from "@svjeez/dom/svelte";
import { recordings } from "@svjeez/dom/vite";

export const used = [browser, Dom, duration, snap, snapshots, fidelity, click, reactDemo, given, message, story, svelteDemo, recordings];

export type Steps = Step[];
