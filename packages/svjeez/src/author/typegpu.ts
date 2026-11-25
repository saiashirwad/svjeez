import type * as TypeGpu from "typegpu";

const KEY: unique symbol = Symbol.for("svjeez.typegpu");
const UNCOMPILED: unique symbol = Symbol.for("svjeez.typegpu.uncompiled");

interface Scope {
  readonly Symbol: SymbolConstructor;
  [KEY]?: typeof TypeGpu;
  [UNCOMPILED]?: Uncompiled;
}

const scope: Scope = globalThis;

/**
 * Hands svjeez the TypeGPU module that a scene's `<Shader>` is resolved to WGSL with. It is kept on `globalThis`, so every
 * copy of svjeez (a bundler's runner, a CLI) sees the one the host loaded. `loadTypeGpu` in `svjeez/tools` does this.
 */
export const provideTypeGpu = (module: typeof TypeGpu): void => {
  scope[KEY] = module;
};

export const typeGpuOf = (): typeof TypeGpu | undefined => scope[KEY];

/** Why this runtime can't compile `"use gpu"` functions, and what to do instead. */
export interface Uncompiled {
  readonly why: string;
  readonly fix: string;
}

/** Records why this runtime can't compile `"use gpu"` functions, for a `<Shader>` to say instead of a TypeGPU error. */
export const cantCompile = (reason: Uncompiled): void => {
  scope[UNCOMPILED] = reason;
};

export const uncompiled = (): Uncompiled | undefined => scope[UNCOMPILED];
