import { FIRST, type Genome } from "./genome";
import { layout, type Layout } from "./layout";

export interface SetOptions {
  /** Where the specimen came from, shown under its number. */
  readonly lineage?: string;
  /** Put it on the shelf as soon as it's drawn, instead of once the edits stop. */
  readonly shelve?: boolean;
}

const current: { genome: Genome; lay: Layout; lineage: string } = { genome: FIRST, lay: layout(FIRST), lineage: "" };

/** The specimen on the stage. `set` is the only writer. */
export const state: Readonly<typeof current> = current;

const listeners: ((opts: SetOptions) => void)[] = [];

/** Runs after every `set`, in the order the listeners were added. */
export const onSet = (listener: (opts: SetOptions) => void) => {
  listeners.push(listener);
};

export const set = (next: Genome, opts: SetOptions = {}) => {
  current.genome = next;
  current.lay = layout(next);
  current.lineage = opts.lineage ?? "";
  for (const listener of listeners) listener(opts);
};
