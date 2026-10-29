// What to film on each side of a change. An agent edits this list to match the diff: a still for anything that changed
// how a page looks, a scroll for anything that changed how it moves. Shots where nothing changed are left out of the
// reel, so listing too many costs only time.
import type { Scheme } from "./capture";

export type Shot =
  | {
      readonly kind: "still";
      readonly name: string;
      readonly title: string;
      readonly path: string;
      /** Scroll this element to the top first. */
      readonly selector?: string;
      readonly scheme?: Scheme;
    }
  | {
      readonly kind: "scroll";
      readonly name: string;
      readonly title: string;
      readonly path: string;
      /** Scrolled from the bottom of the screen to the top. */
      readonly selector: string;
      readonly scheme?: Scheme;
    };

export const shots: readonly Shot[] = [
  { kind: "still", name: "hero", title: "Landing page hero", path: "/" },
  { kind: "still", name: "hero-dark", title: "Landing page hero, dark", path: "/", scheme: "dark" },
  { kind: "still", name: "diagrams", title: "Diagrams section", path: "/", selector: "#diagrams" },
  {
    kind: "scroll",
    name: "icons",
    title: "Scrolling to the icons section",
    path: "/",
    selector: "#icons",
  },
];
