export { Code, type CodeProps, type PartStyle } from "./code.tsx";

export { codeLayout, type CodeBox, type CodeLayout, type CodeStyle } from "./layout.ts";

export { codeTokens, lines, type CodePart, type Split } from "./split.ts";

export {
  bash,
  css,
  diff,
  go,
  html,
  js,
  json,
  jsx,
  md,
  ocaml,
  python,
  rust,
  sql,
  ts,
  tsx,
  yaml,
} from "./langs.ts";

export {
  highlight,
  type Highlighted,
  type HighlightOptions,
  type Lang,
  type Piece,
} from "./highlight.ts";

export { ROLES, type CodeRole, type Palette } from "./roles.ts";
