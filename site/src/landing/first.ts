// The firework the home page's editor starts from, compiled at build time: its file, and the numbers its readout shows until the
// first compile in the browser replaces them.
import { getScene } from "@svjeez/astro/scene";
import type { First } from "@svjeez/live";
import { facts } from "../proof";
import firework from "./firework.tsx";

const scene = getScene(firework);

export const first: First = {
  src: scene.src,
  width: scene.width,
  height: scene.height,
  title: scene.title,
  duration: Number(/animation-duration:([\d.]+)s/.exec(scene.svg)?.[1]),
  stats: {
    gzip: scene.gzip,
    keyframes: (scene.svg.match(/@keyframes\s/g) ?? []).length,
    scriptBytes: facts(scene).script,
  },
};
