import { el } from "../el";
import type { Rect } from "../geometry";
import { motion, type Seconds } from "../motion";
import type { SvgNode } from "../svg";
import { code, type Code, type CodeOptions, type CodePiece } from "./code";
import { defaultDark, type CodeRole } from "./theme";
import { typewriter } from "./typewriter";

export interface TerminalCommand {
  readonly cmd: string;
  /** Printed after the command, one entry per line. */
  readonly output?: readonly (string | readonly CodePiece[])[];
}

export interface TerminalOptions extends Omit<CodeOptions, "gutter"> {
  /** When the first prompt appears. */
  readonly at?: Seconds;
  readonly prompt?: string;
  readonly promptRole?: CodeRole;
  /** Typing speed in characters per second. */
  readonly cps?: number;
  /** From the last typed character to the output. */
  readonly think?: Seconds;
  /** From the output to the next prompt. */
  readonly gap?: Seconds;
}

/** A shell session typed out: each prompt appears, its command types, its output prints. The last command keeps a blinking cursor. */
export function terminal(session: readonly TerminalCommand[], options: TerminalOptions = {}): { readonly node: SvgNode; readonly end: Seconds; readonly bounds: Rect } {
  const { at = 0.5, prompt = "❯", promptRole = "blue", cps = 18, think = 0.35, gap = 0.6, x = 0, y = 0, ...metrics } = options;
  if (session.length === 0) throw new Error("terminal() needs at least one command.");
  const theme = metrics.theme ?? defaultDark;
  const { height } = code("", { ...metrics, theme }).metrics;
  const laid: Code[] = [];
  const line = (pieces: readonly CodePiece[]): Code => {
    laid.push(code([pieces], { ...metrics, theme, x, y: y + laid.length * height }));
    return laid.at(-1)!;
  };
  let clock = at;
  const nodes = session.map(({ cmd, output = [] }, n) => {
    const shown = motion({ opacity: 0 }).at(clock).set({ opacity: 1 });
    const typed = typewriter(line([[promptRole, prompt], " ", cmd]), { at: clock, cps, cursor: true, blink: n === session.length - 1 });
    const printed = typed.end + think;
    const lines = output.map((out, i) => el.g({ animation: motion({ opacity: 0 }).at(printed + i * 0.06).set({ opacity: 1 }) }, line(typeof out === "string" ? [out] : out).node));
    clock = printed + output.length * 0.06 + gap;
    return el.g({ animation: shown }, [typed.node, lines]);
  });
  return { node: el.g({}, nodes), end: clock - gap, bounds: laid.map((c) => c.bounds).reduce((a, b) => a.union(b)) };
}
