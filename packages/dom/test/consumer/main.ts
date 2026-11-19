import { captureScript, compile, film, type Snapshot } from "@svjeez/dom";
import { react } from "@svjeez/dom/react";
import { svelte } from "@svjeez/dom/svelte";
import { component, runFilm } from "@svjeez/dom/vite";

export const script: string = captureScript;

export const frameworks: string[] = [react.name, svelte.name];

export type { Snapshot };

export { compile, component, film, runFilm };
