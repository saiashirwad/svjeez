import { $, $$ } from "../util";
import { restamp } from "./card";
import { drag } from "./drags";
import {
  geneValue,
  mutate,
  numberSpec,
  numericKey,
  random,
  specimenNo,
  withChoice,
  withGene,
  type NumericKey,
} from "./genome";
import { frame } from "./overlay";
import { breedWith, shelf } from "./shelf";
import { set, state } from "./state";

const UNITS: Partial<Record<NumericKey, (v: number) => string>> = {
  length: (v) => `${v.toFixed(1)} cats`,
  girth: (v) => `${v} px girth`,
  legLength: (v) => `${v.toFixed(2)}× legs`,
  tailLength: (v) => `${v.toFixed(2)}× tail`,
  slice: (v) => `w ${(v * 2 - 1).toFixed(2)}`,
  oidness: (v) => `${Math.round(v * 100)}% ${state.genome.oid}`,
  ink: (v) => (v < 0.05 ? "steady line" : `${v.toFixed(1)} boil`),
};

export const paintControls = () => {
  const { genome } = state;

  for (const b of $$<HTMLButtonElement>("[data-gene]")) {
    const on = String(geneValue(genome, b.dataset.gene)) === b.dataset.value;
    b.setAttribute("aria-checked", String(on));
  }

  for (const b of $$<HTMLButtonElement>("[data-scrub]")) {
    const key = numericKey(b.dataset.scrub);
    const v = genome[key];
    const { min, max } = numberSpec(key);
    b.textContent = UNITS[key]?.(v) ?? String(v);
    b.style.setProperty("--p", String((v - min) / (max - min)));
    b.disabled =
      (key === "slice" && genome.dimension !== "4d") || (key === "oidness" && genome.oid === "cat");
  }
};

for (const b of $$<HTMLButtonElement>("[data-gene]"))
  b.addEventListener("click", () => {
    set(withChoice(state.genome, b.dataset.gene, b.dataset.value));
    restamp();
  });

/** Drag a value sideways; arrow keys step it. */
for (const b of $$<HTMLButtonElement>("[data-scrub]")) {
  const key = numericKey(b.dataset.scrub);
  const { min, max, step } = numberSpec(key);
  b.addEventListener("pointerdown", (e) => {
    if (b.disabled) return;
    const v0 = state.genome[key];
    drag(e, {
      move: (m) =>
        set(withGene(state.genome, key, v0 + ((m.clientX - e.clientX) / 160) * (max - min))),
    });
  });
  b.addEventListener("keydown", (e) => {
    const d =
      e.key === "ArrowRight" || e.key === "ArrowUp"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowDown"
          ? -1
          : 0;

    if (!d) return;
    e.preventDefault();
    set(withGene(state.genome, key, state.genome[key] + d * Math.max(step, (max - min) / 40)));
  });
}

$("[data-mutate]").addEventListener("click", () => {
  const m = mutate(state.genome);
  set(m.genome, { shelve: true, lineage: m.tooFar ? "mutated too far" : "" });
  restamp();

  if (m.tooFar)
    frame.animate(
      [{ rotate: "0deg" }, { rotate: "-2deg" }, { rotate: "1.5deg" }, { rotate: "0deg" }],
      { duration: 380 },
    );
});

$("[data-dice]").addEventListener("click", () => {
  set(random(), { shelve: true });
  restamp();
});

$("[data-breed]").addEventListener("click", () => {
  const current = specimenNo(state.genome);
  const mates = shelf.filter((s) => s.no !== current);
  breedWith(
    mates.length
      ? mates[Math.floor(Math.random() * Math.min(mates.length, 5))]!
      : { genome: random(), no: "wild" },
  );
});
