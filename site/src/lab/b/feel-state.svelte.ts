import { createContext } from "svelte";
import { compilerFor, latestWins } from "../compiler";
import { svgUrl } from "../util";
import { defaults, fitValues } from "svjeez/params";
import { params, type Feel } from "./scene";
import first from "./scene.tsx?svjeez";

export const DEFAULT_FEEL: Feel = defaults(params);

/** The feel the instruments edit. Each replacement of `feel` recompiles the scene. */
export class Lab {
  feel = $state.raw<Feel>(DEFAULT_FEEL);

  /** Sets what `patch` carries, each number fitted to its param's range and step. */
  update(patch: Partial<Feel>) {
    this.feel = { ...this.feel, ...fitValues(params, patch) };
  }
}

export const [getLab, setLab] = createContext<Lab>();

/** The compiled file the stage shows: the build's picture of the default feel until the first edit compiles. */
export class Stage {
  url = $state(first.src);
  files = $state(0);
  gzip = $state(0);
  ms = $state(0);
  error = $state<string>();

  #push?: (feel: Feel) => void;

  /** Compiles `feel` on the lab's worker; only the newest feel waiting behind a running compile survives. */
  build(feel: Feel) {
    this.#push ??= latestWins(this.#draw);
    this.#push(feel);
  }

  #compile?: ReturnType<typeof compilerFor<Feel>>;

  #draw = async (feel: Feel) => {
    this.#compile ??= compilerFor<Feel>(
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
      (job) => ({ feel: job }),
    );
    const result = await this.#compile(feel);

    if (!result.ok) {
      this.error = result.error.message;

      return;
    }

    const old = this.url;
    this.url = svgUrl(result.svg);
    this.files++;
    this.gzip = result.stats.gzip;
    this.ms = Math.round(result.ms);
    this.error = undefined;

    if (old.startsWith("blob:")) setTimeout(() => URL.revokeObjectURL(old), 2000);
  };
}
