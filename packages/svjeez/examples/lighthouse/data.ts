import { readFileSync } from "node:fs";
import { join } from "node:path";

export type Family = "claude" | "gpt";

export type Tool = "read" | "edit" | "test" | "delegate" | "research";

export type Kind = Tool | "msg" | "done";

type Moment =
  | { readonly at: number; readonly k: "became"; readonly state: "idle" | "running" }
  | { readonly at: number; readonly k: "used"; readonly colour: Tool }
  | { readonly at: number; readonly k: "messaged"; readonly to: string };

interface RawThread {
  readonly id: string;
  readonly parent: string | null;
  readonly family: Family;
  readonly created: number;
  readonly moments: readonly Moment[];
}

/** Scene seconds per real second. */
export const SPEED = 300;

/** Quiet stretches longer than this many real ms are cut down to it. */
const CAP_MS = 60_000;
const INTRO = 1.2;

export interface Thread {
  readonly index: number;
  readonly name: string;
  readonly parent: number | undefined;
  readonly family: Family;
  readonly born: number;
  /** Running spans in scene seconds; an open span ends at `end`. */
  readonly runs: readonly (readonly [number, number])[];
  readonly labels: readonly { readonly t: number; readonly kind: Kind }[];
  readonly last: number;
}

export interface Message {
  readonly t: number;
  readonly from: number;
  readonly to: number;
}

// SAFETY: publication.json is a checked-in export with this shape, and this read is its only parse
const raw = JSON.parse(readFileSync(join(import.meta.dirname, "publication.json"), "utf8")) as {
  readonly publications: readonly { readonly threads: readonly RawThread[] }[];
};

const threads = [...raw.publications[0]!.threads].sort((a, b) => a.created - b.created);

/** Real ms to scene seconds, with every gap between events capped. */
const clock = (() => {
  const times = [
    ...new Set(
      threads.flatMap((thread) => [thread.created, ...thread.moments.map((moment) => moment.at)]),
    ),
  ].sort((a, b) => a - b);

  const scene = new Map<number, number>();
  let t = INTRO;
  times.forEach((time, i) => {
    if (i > 0) t += Math.min(time - times[i - 1]!, CAP_MS) / 1000 / SPEED;
    scene.set(time, t);
  });

  return (ms: number): number => scene.get(ms)!;
})();

const indexOf = new Map(threads.map((thread, i) => [thread.id, i]));

export const end = Math.max(
  ...threads.flatMap((thread) => thread.moments.map((moment) => clock(moment.at))),
);

export const messages: readonly Message[] = threads.flatMap((thread, from) =>
  thread.moments.flatMap((moment) =>
    moment.k === "messaged" ? [{ t: clock(moment.at), from, to: indexOf.get(moment.to)! }] : [],
  ),
);

export const graph: readonly Thread[] = threads.map((thread, index) => {
  const runs: [number, number][] = [];
  let since: number | undefined;
  const labels: { t: number; kind: Kind }[] = [];

  for (const moment of thread.moments) {
    const t = clock(moment.at);

    if (moment.k === "used") labels.push({ t, kind: moment.colour });
    else if (moment.k === "messaged") labels.push({ t, kind: "msg" });
    else if (moment.state === "running") since ??= t;
    else if (since !== undefined) {
      runs.push([since, t]);
      labels.push({ t, kind: "done" });
      since = undefined;
    }
  }

  if (since !== undefined) runs.push([since, end]);

  return {
    index,
    name: `TH-${String(index + 1).padStart(2, "0")}`,
    parent: thread.parent === null ? undefined : indexOf.get(thread.parent),
    family: thread.family,
    born: clock(thread.created),
    runs,
    labels,
    last: clock(thread.moments.at(-1)!.at),
  };
});
