export const C = {
  bg: "#0B0907",
  bgDeep: "#080706",
  bgEdge: "#0C0A08",
  panel: "#100E0B",
  chrome: "#15120E",
  card: "#15120E",
  line: "#2A241C",
  lineSoft: "#2E2820",
  ink: "#EFE7D8",
  text: "#D8CFBF",
  textSoft: "#B0A696",
  muted: "#8C8377",
  faint: "#5D554A",
  faintest: "#4B443B",
  dim: "#6B6255",
  footer: "#575046",
  gold: "#D6A96D",
  sage: "#A3B9A0",
  lavender: "#B4A6D2",
  blue: "#9AAFC5",
  coral: "#CE8A72",
  sageText: "#BBD0BB",
  lavText: "#C9BCE2",
  blueText: "#B7C6D4",
  sourceText: "#AFC4AF",
  planText: "#C7C0D8",
  replyText: "#C6CFC3",
  noteInk: "#C9C0B0",
  rule: "#EDE6D8",
} as const;

export const THEME_CSS = `
.ui{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif}
.ser{font-family:ui-serif,"Iowan Old Style","Palatino Linotype",Palatino,"Book Antiqua",Georgia,serif;letter-spacing:-.4px}
.mono{font-family:ui-monospace,SFMono-Regular,"SF Mono",Menlo,Consolas,monospace;letter-spacing:.1px}
`.trim();

export const TITLE = "Strata — an outliner with agents in the margin";

export const DESC =
  'A quiet note titled "Retention is a supply problem" builds as an outline. The writer types a question and mentions the researcher Scout. Scout answers in the margin with a sourced reply, which is then inserted into the outline as a child node. Atlas, a planner, turns another bullet into a nested two-week plan. Verity, a critic, cross-checks the note and flags a conflict between the pricing promise and a March decision. A closing card reads: Ask anywhere. Answer in place.';
