import { buildWorld } from "./art/world";

/** Mossbell with nobody in it: the same picture the game plays in, as one animated SVG with no script. */
export default function build(): string {
  return buildWorld().svg;
}
