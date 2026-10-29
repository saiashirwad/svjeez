import { compilerFor, latestWins } from "../compiler";
import { $, svgUrl } from "../util";
import type { Genome } from "./genome";
import { specimenNo, taxon } from "./genome";
import { DURATION } from "./geometry";
import { state, type SetOptions } from "./state";

/** The compiled file for a genome, or the error that stopped it. */
export const compile = compilerFor<Genome>(new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }), (genome) => ({ genome }));

const img = $<HTMLImageElement>("[data-stage]");
const statFile = $("[data-file]");
const statGzip = $("[data-gzip]");
const statMs = $("[data-ms]");
const save = $<HTMLAnchorElement>("[data-save]");
const errorBox = $("[data-error]");

const origin = performance.now();
const loopTime = () => (((performance.now() - origin) / 1000) % DURATION + DURATION) % DURATION;
const atTime = (svg: string, t: number) => svg.replace("<svg ", `<svg style="--t0:-${t.toFixed(3)}s" `);

/** A still of the file: CSS paused at t, the boiling SMIL removed. */
export const still = (svg: string, t: number) =>
  atTime(svg, t)
    .replace("<style><![CDATA[", "<style><![CDATA[\n.a{animation-play-state:paused!important}")
    .replace(/<animate\b[^>]*\/>/g, "");

/** A genome to compile, and whether the shelf keeps it once it's drawn. */
interface Job {
  readonly genome: Genome;
  readonly shelve: boolean;
}

let shown = "";
let saveUrl = "";

/** Swaps the picture once the new file has loaded, starting it at the loop's current moment so nothing rewinds. */
const show = (svg: string) =>
  new Promise<void>((resolve) => {
    const url = svgUrl(atTime(svg, loopTime()));
    const next = new Image();
    next.onload = next.onerror = () => {
      const old = shown;
      img.src = url;
      shown = url;
      if (old) setTimeout(() => URL.revokeObjectURL(old), 1000);
      resolve();
    };
    next.src = url;
  });

const drawn: ((g: Genome, svg: string) => void)[] = [];

/** Runs when a job that asked for the shelf has been drawn. */
export const onShelve = (listener: (g: Genome, svg: string) => void) => {
  drawn.push(listener);
};

const draw = async ({ genome: g, shelve }: Job) => {
  const result = await compile(g);
  if (!result.ok) {
    errorBox.hidden = false;
    errorBox.textContent = result.error.message;
    return;
  }
  await show(result.svg);
  const no = specimenNo(g);
  if (saveUrl) URL.revokeObjectURL(saveUrl);
  saveUrl = svgUrl(result.svg);
  save.href = saveUrl;
  save.download = `${taxon(g).split(" ").slice(0, 2).join("-").toLowerCase()}-${no}.svg`;
  statFile.textContent = `catoid-${no}.svg`;
  statGzip.textContent = `${(result.stats.gzip / 1024).toFixed(1)} KB gzip`;
  statMs.textContent = `${Math.round(result.ms)} ms`;
  errorBox.hidden = true;
  if (shelve) for (const listener of drawn) listener(g, result.svg);
};

const push = latestWins(draw);

let lastKey = "";
const request = (g: Genome, shelve: boolean) => {
  const key = JSON.stringify(g);
  if (key === lastKey && !shelve) return;
  lastKey = key;
  push({ genome: g, shelve });
};

let settleTimer = 0;

/** Compiles the specimen on the stage. Hand edits go on the shelf once they stop changing. */
export const compileCurrent = ({ shelve }: SetOptions) => {
  clearTimeout(settleTimer);
  request(state.genome, !!shelve);
  if (!shelve) settleTimer = window.setTimeout(() => request(state.genome, true), 1400);
};
