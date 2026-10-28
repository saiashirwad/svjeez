import { render } from "svjeez";
import { Marker, code, morph, type CodeRun, type CodeTokens } from "svjeez/extras";
import { CSS, theme } from "./kit";

const kw = (text: string): CodeRun => ["keyword", text];
const p = (text: string): CodeRun => ["punct", text];

const before: CodeTokens = [
  [kw("const"), " total ", p("="), " ", ["fn", "sum", "call"], p("("), "xs", p(");")],
  [kw("return"), " total", p(";")],
];
const after: CodeTokens = [
  [kw("const"), " total ", p("="), " xs", p("."), ["fn", "reduce", "call"], p("("), "add", p(","), " ", ["number", "0"], p(");")],
  [kw("return"), " total", p(";")],
];

const settings = { x: 52, y: 40, fontSize: 15, theme };
const one = code(before, settings);
const two = code(after, settings);
const m = morph([one, two, one], { at: [2, 5.5], over: 0.8, gutter: true });

export default function build(): string {
  return render(
    { width: 360, height: 110, duration: 8, title: "Code morph", desc: "A call to sum morphs into a reduce and back, with a marker following the call.", css: CSS, reducedMotion: { at: 1 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <Marker stops={[{ during: { at: 0.5, over: 1 }, target: one.get("call").pad(3) }, { during: { at: 2, over: 3 }, target: two.get("call").pad(3) }, { during: { at: 5.5, over: 2 }, target: one.get("call").pad(3) }]} />
      <g class="mono">{m.node}</g>
    </>,
  );
}
