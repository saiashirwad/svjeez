import { $$ } from "../util";
import { carryDrag } from "./drags";
import { addPart, partNamed, removePart } from "./edit";
import { showDrop, viewPoint } from "./overlay";
import { state } from "./state";

/** The parts bin: drag a part onto the stage, press Enter on it to add one, press - on it to take one away. */
for (const b of $$<HTMLButtonElement>("[data-part]")) {
  const part = partNamed(b.dataset.part);
  const icon = b.querySelector("svg")!.outerHTML;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    carryDrag(e, {
      html: icon,
      slop: 6,
      over: (m) => showDrop(viewPoint(m), part),
      end: (u, lifted) => {
        if (!lifted) return addPart(part);
        const vp = viewPoint(u);
        if (vp.inside) addPart(part, vp);
      },
      clear: () => showDrop(undefined),
    });
  });
  b.addEventListener("click", (e) => {
    if (e.detail === 0) addPart(part);
  });
  b.addEventListener("keydown", (e) => {
    if (e.key === "-" || e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      removePart(part);
    }
  });
}

for (const b of $$<HTMLButtonElement>("[data-less]")) {
  const part = partNamed(b.dataset.less);
  b.addEventListener("click", () => removePart(part, part === "eyes" && state.genome.eyes === 0));
}
