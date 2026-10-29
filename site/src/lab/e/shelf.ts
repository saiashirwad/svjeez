import { $, svgUrl } from "../util";
import { restamp } from "./card";
import { carryDrag } from "./drags";
import { breed, parseGenome, specimenNo, taxon, type Genome } from "./genome";
import { frame, viewPoint } from "./overlay";
import { compile, onShelve, still } from "./preview";
import { set, state } from "./state";

const SHELF_SIZE = 18;
const STORE = "svjeez-lab-e-shelf";

/** The moment of the loop a jar's thumbnail shows. */
const THUMB_AT = 1.4;

export interface Specimen {
  readonly genome: Genome;
  readonly no: string;
  thumb?: string;
}

export const shelf: Specimen[] = [];
const shelfList = $("[data-shelf]");

const persist = () => {
  try {
    localStorage.setItem(STORE, JSON.stringify(shelf.map((s) => s.genome)));
  } catch {}
};

const shelve = (g: Genome, svg: string) => {
  const no = specimenNo(g);
  const found = shelf.findIndex((s) => s.no === no);
  const entry = found >= 0 ? shelf.splice(found, 1)[0]! : { genome: g, no };

  if (entry.thumb) URL.revokeObjectURL(entry.thumb);
  entry.thumb = svgUrl(still(svg, THUMB_AT));
  shelf.unshift(entry);

  for (const gone of shelf.splice(SHELF_SIZE)) if (gone.thumb) URL.revokeObjectURL(gone.thumb);
  persist();
  paintShelf();
};

export const breedWith = (other: Specimen) => {
  const parent = specimenNo(state.genome);
  set(breed(state.genome, other.genome), { shelve: true, lineage: `${parent} × ${other.no}` });
  restamp();
};

/** Carry a jar onto the stage to breed with it; click, or Enter on the focused jar, to bring it back. */
const wireJar = (b: HTMLButtonElement, s: Specimen) => {
  const bringBack = () => {
    set(s.genome, { lineage: "from the shelf" });
    restamp();
  };

  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    carryDrag(e, {
      html: `<img src="${s.thumb ?? ""}" alt="">`,
      slop: 8,
      over: (m, lifted) => frame.classList.toggle("le-mating", lifted && viewPoint(m).inside),
      end: (u, lifted) => {
        if (!lifted) return bringBack();

        if (viewPoint(u).inside && s.no !== specimenNo(state.genome)) breedWith(s);
      },
      clear: () => frame.classList.remove("le-mating"),
    });
  });
  b.addEventListener("click", (e) => {
    if (e.detail === 0) bringBack();
  });
};

export const paintShelf = () => {
  const current = specimenNo(state.genome);
  shelfList.replaceChildren(
    ...shelf.map((s) => {
      const li = document.createElement("li");
      const b = document.createElement("button");
      b.type = "button";
      b.className = "le-jar";
      b.dataset.no = s.no;
      b.setAttribute("aria-label", `${taxon(s.genome)}, specimen ${s.no}`);

      if (s.no === current) b.setAttribute("aria-current", "true");
      const pic = document.createElement("img");
      pic.alt = "";
      pic.draggable = false;

      if (s.thumb) pic.src = s.thumb;
      const label = document.createElement("span");
      label.textContent = s.no;
      b.append(pic, label);
      wireJar(b, s);
      li.append(b);

      return li;
    }),
  );
};

/** Moves the aria-current mark to the jar of the specimen on the stage. */
export const markCurrent = () => {
  const current = specimenNo(state.genome);

  for (const jar of shelfList.querySelectorAll<HTMLElement>(".le-jar")) {
    if (jar.dataset.no === current) jar.setAttribute("aria-current", "true");
    else jar.removeAttribute("aria-current");
  }
};

/** Restores shelved genomes from an earlier visit, compiling their thumbnails one by one. */
export const restoreShelf = async () => {
  let saved: unknown = [];

  try {
    saved = JSON.parse(localStorage.getItem(STORE) ?? "[]");
  } catch {}

  for (const raw of Array.isArray(saved) ? saved.slice(0, SHELF_SIZE) : []) {
    const g = parseGenome(raw);

    if (!g) continue;
    const no = specimenNo(g);

    if (!shelf.some((s) => s.no === no)) shelf.push({ genome: g, no });
  }

  paintShelf();

  for (const s of [...shelf]) {
    if (s.thumb) continue;
    const r = await compile(s.genome);

    if (r.ok && !s.thumb && shelf.includes(s)) s.thumb = svgUrl(still(r.svg, THUMB_AT));
  }

  paintShelf();
};

export const startShelf = () => {
  onShelve(shelve);
  paintShelf();
};
