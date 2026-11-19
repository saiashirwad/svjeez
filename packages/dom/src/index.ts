export { capture, captureScript } from "./capture.ts";

export { SNAPSHOT_VERSION, checkVersion } from "./schema.ts";

export { compile, type Compiled, type Diagnostic } from "./compile/index.ts";

export {
  openPage,
  record,
  type EaseName,
  type OpenPageOptions,
  type RecordOptions,
  type Snap,
  type State,
  type Timing,
} from "./record.ts";

export { cached } from "./cache.ts";

export { inlineAssets, type AssetOptions } from "./assets.ts";

export { mergeSchemes } from "./scheme.ts";

export type * from "./schema.ts";
