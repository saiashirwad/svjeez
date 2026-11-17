import { createContext } from "svelte";
import { restyle } from "svjeez/page";
import { compilerFor, latestWins } from "@svjeez/live/client";
import { lazy, svgUrl } from "../util";
import type { At } from "./drags";
import { carryDrag, type Carrying } from "./drags";
import type { Part } from "./edit";
import { hitTest, toScreen } from "./edit";
import {
  breed,
  FIRST,
  parseGenome,
  random,
  specimenNo,
  taxon,
  type Genome,
  type Stored,
} from "./genome";
import { H, W } from "./geometry";
import { layout } from "./layout";
import { loopTime, preload } from "./preview";

const SHELF_SIZE = 18;
const STORE = "svjeez-lab-e-shelf";

const THUMB_AT = 1.4;

/** How long hand edits must rest before the specimen goes on the shelf, in ms. */
const SETTLE = 1400;

export interface SetOptions {
  readonly lineage?: string;
  readonly shelve?: boolean;
}

interface Staged {
  readonly genome: Genome;
  readonly lineage: string;
  readonly shelve: boolean;
}

export interface Specimen {
  readonly genome: Genome;
  readonly no: string;
  readonly thumb?: string;
}

interface Drawn {
  readonly src: string;
  readonly href: string;
  readonly download: string;
  readonly file: string;
  readonly gzip: string;
  readonly ms: string;
}

export type Ghost =
  | { readonly kind: "part"; readonly part: Part }
  | { readonly kind: "jar"; readonly thumb: string };

export class Lab {
  staged = $state.raw<Staged>({ genome: FIRST, lineage: "", shelve: true });
  genome = $derived(this.staged.genome);
  lay = $derived(layout(this.genome));
  no = $derived(specimenNo(this.genome));

  shelf = $state.raw<readonly Specimen[]>([]);
  drawn = $state.raw<Drawn>();
  error = $state("");

  overlay = $state.raw<SVGSVGElement>();
  drop = $state.raw<{ readonly x: number; readonly y: number; readonly r: number }>();
  carried = $state.raw<{ readonly ghost: Ghost; readonly at: At }>();
  mating = $state(false);
  stretching = $state(false);
  stamps = $state(0);
  shakes = $state(0);

  #worker?: Worker;
  #compile = lazy(() => {
    this.#worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });

    return compilerFor<Genome>(this.#worker, (genome) => ({ genome }));
  });

  set(genome: Genome, opts: SetOptions = {}) {
    this.staged = { genome, lineage: opts.lineage ?? "", shelve: !!opts.shelve };
  }

  restamp() {
    this.stamps++;
  }

  breedWith(other: Specimen) {
    this.set(breed(this.genome, other.genome), {
      shelve: true,
      lineage: `${this.no} × ${other.no}`,
    });
    this.restamp();
  }

  breedAny() {
    const mates = this.shelf.filter((s) => s.no !== this.no);
    this.breedWith(
      mates.length
        ? mates[Math.floor(Math.random() * Math.min(mates.length, 5))]!
        : { genome: random(), no: "wild" },
    );
  }

  bringBack(s: Specimen) {
    this.set(s.genome, { lineage: "from the shelf" });
    this.restamp();
  }

  viewPoint(e: PointerEvent) {
    const r = this.overlay!.getBoundingClientRect();

    return {
      x: ((e.clientX - r.left) / r.width) * W,
      y: ((e.clientY - r.top) / r.height) * H,
      inside:
        e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom,
    };
  }

  showDrop(m?: PointerEvent, part?: Part) {
    const vp = m && this.viewPoint(m);

    if (!vp?.inside || !part) {
      this.drop = undefined;

      return;
    }

    const { lay } = this;
    const hit = hitTest(lay, vp);
    const f = lay.frames[Math.round(hit.s * (lay.frames.length - 1))]!;

    const at =
      part === "heads" || part === "ears" || (part === "eyes" && hit.head >= 0)
        ? vp
        : toScreen(lay, f.p);

    this.drop = { x: at.x, y: at.y, r: Math.max(10, lay.G * lay.scale * 0.6) };
  }

  carry(down: PointerEvent, ghost: Ghost, o: Omit<Carrying, "float">) {
    carryDrag(down, { ...o, float: (at) => (this.carried = at && { ghost, at }) });
  }

  #lastKey = "";

  #push = latestWins(async ({ genome, shelve }: { genome: Genome; shelve: boolean }) => {
    const result = await this.#compile()(genome);

    if (!result.ok) {
      this.error = result.error.message;

      return;
    }

    const src = await preload(svgUrl(restyle(result.svg, { at: loopTime() })));
    const old = this.drawn;
    const no = specimenNo(genome);
    this.drawn = {
      src,
      href: svgUrl(result.svg),
      download: `${taxon(genome).split(" ").slice(0, 2).join("-").toLowerCase()}-${no}.svg`,
      file: `catoid-${no}.svg`,
      gzip: `${(result.stats.gzip / 1024).toFixed(1)} KB gzip`,
      ms: `${Math.round(result.ms)} ms`,
    };

    if (old) {
      setTimeout(() => URL.revokeObjectURL(old.src), 1000);
      URL.revokeObjectURL(old.href);
    }

    this.error = "";

    if (shelve) this.#shelve(genome, result.svg);
  });

  #request(genome: Genome, shelve: boolean) {
    const key = JSON.stringify(genome);

    if (key === this.#lastKey && !shelve) return;
    this.#lastKey = key;
    this.#push({ genome, shelve });
  }

  compileStaged({ genome, shelve }: Staged) {
    this.#request(genome, shelve);

    if (shelve) return;
    const settle = setTimeout(() => this.#request(genome, true), SETTLE);

    return () => clearTimeout(settle);
  }

  #shelve(genome: Genome, svg: string) {
    const no = specimenNo(genome);
    const found = this.shelf.find((s) => s.no === no);

    if (found?.thumb) URL.revokeObjectURL(found.thumb);

    const next = [
      {
        genome: found?.genome ?? genome,
        no,
        thumb: svgUrl(restyle(svg, { at: THUMB_AT, paused: true })),
      },
      ...this.shelf.filter((s) => s !== found),
    ];

    for (const gone of next.splice(SHELF_SIZE)) if (gone.thumb) URL.revokeObjectURL(gone.thumb);
    this.shelf = next;

    try {
      localStorage.setItem(STORE, JSON.stringify(next.map((s) => s.genome)));
    } catch {}
  }

  async restoreShelf() {
    let saved: Stored = [];

    try {
      saved = JSON.parse(localStorage.getItem(STORE) ?? "[]");
    } catch {}

    const restored = [...this.shelf];

    for (const raw of Array.isArray(saved) ? saved.slice(0, SHELF_SIZE) : []) {
      const g = parseGenome(raw);

      if (!g) continue;
      const no = specimenNo(g);

      if (!restored.some((s) => s.no === no)) restored.push({ genome: g, no });
    }

    this.shelf = restored;

    for (const s of restored) {
      if (s.thumb) continue;
      const r = await this.#compile()(s.genome);
      const now = this.shelf.find((x) => x.no === s.no);

      if (!r.ok || !now || now.thumb) continue;
      const thumb = svgUrl(restyle(r.svg, { at: THUMB_AT, paused: true }));
      this.shelf = this.shelf.map((x) => (x === now ? { ...x, thumb } : x));
    }
  }

  dispose() {
    this.#worker?.terminate();

    for (const url of [this.drawn?.src, this.drawn?.href, ...this.shelf.map((s) => s.thumb)])
      if (url) URL.revokeObjectURL(url);
  }
}

export const [getLab, setLab] = createContext<Lab>();
