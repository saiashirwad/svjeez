import type * as TypeGpu from "typegpu";

const KEY: unique symbol = Symbol.for("svjeez.typegpu");
const UNCOMPILED: unique symbol = Symbol.for("svjeez.typegpu.uncompiled");

interface Scope {
  readonly Symbol: SymbolConstructor;
  [KEY]?: typeof TypeGpu;
  [UNCOMPILED]?: string;
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

/** Records why this runtime can't compile `"use gpu"` functions, for a `<Shader>` to say instead of a TypeGPU error. */
export const cantCompile = (why: string): void => {
  scope[UNCOMPILED] = why;
};

/** Why this runtime can't compile `"use gpu"` functions, if it can't. */
export const uncompiled = (): string | undefined => scope[UNCOMPILED];
