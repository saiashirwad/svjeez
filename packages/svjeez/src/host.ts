import type { Problem } from "./check/inspect-context";

/**
 * What a program that embeds the CLI gives it in place of a package on disk: the single-file svjeez binary sets one
 * before it loads the CLI, so the CLI finds the skill, the optional packages and itself inside the binary.
 */
export interface Host {
  /** Printed by `svjeez version`. */
  readonly version?: string;
  /** The argv that runs this CLI again, executable first, for commands that run it in a child process (dev). */
  readonly self?: readonly string[];
  /** The skill's files, by path inside the skill folder: SKILL.md, references/check.md, fonts and so on. */
  readonly skill?: () => Promise<ReadonlyMap<string, string | Uint8Array>>;
  /** An optional package, such as @svjeez/video, when the host carries it. */
  readonly module?: (name: string) => Promise<object> | undefined;
  /** More problems for `check` to report about a scene file, such as type errors. */
  readonly check?: (file: string) => Promise<readonly Problem[]>;
  /** More commands, by name. */
  readonly commands?: ReadonlyMap<string, (args: string[]) => Promise<void>>;
  /** Usage lines for those commands, appended to the CLI's own. */
  readonly usage?: string;
  /** The command that installs a Chromium to render with, for the error when there is none. */
  readonly installBrowser?: string;
}

const HOST: unique symbol = Symbol.for("svjeez.host");

interface Scope {
  readonly Symbol: SymbolConstructor;
  [HOST]?: Host;
}

const scope: Scope = globalThis;

export const setHost = (host: Host): void => {
  scope[HOST] = host;
};

export const hostOf = (): Host => scope[HOST] ?? {};
