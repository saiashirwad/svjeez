import { createContext } from "svelte";
import { compilerFor, latestWins } from "@svjeez/live/client";
import { lazy, svgUrl } from "../util";
import { defaults } from "svjeez/params";
import { fitValues } from "@svjeez/live/fit";
import { params, type Feel } from "./scene";
import first from "./scene.tsx?svjeez";

export const DEFAULT_FEEL: Feel = defaults(params);

export class Lab {
  feel = $state.raw<Feel>(DEFAULT_FEEL);

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

  build(feel: Feel) {
    this.#push ??= latestWins(this.#draw);
    this.#push(feel);
  }

  #compile = lazy(() =>
    compilerFor<Feel>(
      new Worker(new URL("./worker.ts", import.meta.url), { type: "module" }),
      (job) => ({ feel: job }),
    ),
  );

  #draw = async (feel: Feel) => {
    const result = await this.#compile()(feel);

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
