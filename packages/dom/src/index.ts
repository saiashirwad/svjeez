export { capture, captureScript } from "./capture.ts";

export { SNAPSHOT_VERSION, checkVersion } from "./schema.ts";

export {
  compile,
  type CompileOptions,
  type Compiled,
  type Diagnostic,
  type PairBy,
} from "./compile/index.ts";

export {
  openPage,
  record,
  type EaseName,
  type OpenPageOptions,
  type Point,
  type Pointer,
  type RecordOptions,
  type Snap,
  type State,
  type Timing,
} from "./record.ts";

export { cached } from "./cache.ts";

export { inlineAssets, type AssetOptions } from "./assets.ts";

export { mergeSchemes } from "./scheme.ts";

export { themeCss } from "./compile/theme.ts";

export type * from "./schema.ts";

export { film, settleScript, type FilmContext, type FilmOptions } from "./film.ts";

export type { Target } from "./target.ts";

export type { BrowserAdapter, Framework } from "./framework.ts";

export { react } from "./frameworks/react.ts";

export { svelte } from "./frameworks/svelte.ts";

export {
  serializeProps,
  type Json,
  type PropsFor,
  type PropsOf,
  type Wire,
  type WireProps,
} from "./props.ts";

export type { ComponentOptions } from "./component.ts";
