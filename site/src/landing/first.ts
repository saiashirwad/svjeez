import { getScene } from "@svjeez/astro/scene";
import type { First } from "@svjeez/live";
import { facts } from "../proof";
import wave from "./wave.tsx";

const scene = getScene(wave);

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
