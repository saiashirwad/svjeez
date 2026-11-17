import { appWindow, render, terminal, type TerminalCommand } from "svjeez";
import { rect } from "svjeez/geometry";
import { choice, defaults, list, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, css, mono, theme } from "../../../examples/gallery-style";

export const params = {
  title: text("~/app", {
    maxLength: 40,
    label:
      "The window title, usually the working directory such as ~/projects/api. At most 40 characters.",
  }),
  lines: list(
    {
      kind: choice("command", ["command", "output"], {
        label: "command for something typed at the prompt, output for a line it prints.",
      }),
      text: text("", {
        maxLength: 72,
        label: "The line, without the prompt sign. At most 72 characters.",
      }),
    },
    [
      { kind: "command", text: "bun install" },
      { kind: "output", text: "installed 142 packages" },
      { kind: "command", text: "bun test" },
      { kind: "output", text: "✓ 38 tests passed" },
      { kind: "command", text: "bun run build" },
      { kind: "output", text: "✓ dist/app.js   29.4 KB" },
      { kind: "output", text: "✓ dist/app.css   6.0 KB" },
    ],
    {
      min: 1,
      max: 24,
      label:
        "The session from top to bottom, 1 to 24 lines. The first line is a command; each output line prints under the command before it.",
    },
  ),
};

/** One line's height in px: 18px type at 1.7. */
const LINE = 30.6;
const BAR = appWindow(rect(0, 0, 100, 100), { theme }).body.y;

type Line = Values<typeof params>["lines"][number];

const session = (lines: readonly Line[]): TerminalCommand[] => {
  const commands: TerminalCommand[] = [];

  for (const [i, line] of lines.entries()) {
    const last = commands.at(-1);

    if (line.kind === "command") commands.push({ cmd: line.text });
    else if (last)
      commands[commands.length - 1] = { ...last, output: [...(last.output ?? []), line.text] };
    else
      throw new Error(
        `lines[${i}] is output before any command. Start the session with a command.`,
      );
  }

  return commands;
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const height = Math.max(HEIGHT, Math.ceil(2 * MARGIN + BAR + 32 + p.lines.length * LINE));

  const shell = appWindow(rect(MARGIN, MARGIN, WIDTH - 2 * MARGIN, height - 2 * MARGIN), {
    theme,
    title: p.title,
    dots: "traffic",
  });

  const typed = terminal(session(p.lines), {
    theme,
    x: shell.body.x + 28,
    y: shell.body.y + 16,
    fontSize: 18,
    lineHeight: LINE / 18,
    font: mono,
    cps: Math.max(24, p.lines.reduce((sum, line) => sum + line.text.length, 0) / 8),
  });

  const D = typed.span.end + 3;

  return render(
    {
      width: WIDTH,
      height,
      duration: D,
      title: `Terminal session in ${p.title}`,
      desc: `A terminal session typed out line by line: ${p.lines.map((line) => line.text).join("; ")}.`,
      reducedMotion: { at: typed.span.end + 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g fontFamily={mono}>{shell.node}</g>
      {typed.node}
    </>,
  );
}
