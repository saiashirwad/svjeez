import type * as TypeGpu from "typegpu";

const KEY: unique symbol = Symbol.for("svjeez.typegpu");

interface Scope {
  readonly Symbol: SymbolConstructor;
  [KEY]?: typeof TypeGpu;
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
