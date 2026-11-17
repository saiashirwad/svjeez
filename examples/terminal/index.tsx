import { render, terminal, appWindow, type CodePiece, type TerminalCommand } from "svjeez";
import { rect } from "svjeez/geometry";
import { choice, defaults, list, text, type Values } from "svjeez/params";

import { HEIGHT, MARGIN, WIDTH, css, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;

const COLORS = ["red", "green", "yellow", "blue", "magenta", "cyan", "muted"] as const;

export const params = {
  title: text("Terminal session", { maxLength: 60 }),
  desc: text(
    "A terminal session installs dependencies, runs tests and builds, typed out line by line.",
    { maxLength: 300, label: "What the session shows, for screen readers" },
  ),
  window: text("~/app", {
    maxLength: 40,
    label: "The window title, usually the working directory",
  }),
  lines: list(
    {
      kind: choice("command", ["command", "output"]),
      text: text("", {
        maxLength: 64,
        label: `Output may color a run as {color text}, with color one of ${COLORS.join(", ")}`,
      }),
    },
    [
      { kind: "command", text: "bun install" },
      { kind: "output", text: "{blue installed 142 packages}" },
      { kind: "command", text: "bun test" },
      { kind: "output", text: "{green ✓} 38 tests passed" },
      { kind: "command", text: "bun run build" },
      { kind: "output", text: "{green ✓} dist/app.js   {magenta 29.4 KB}" },
      { kind: "output", text: "{green ✓} dist/app.css  {magenta  6.0 KB}" },
    ],
    { min: 1, max: 10, label: "The session in order: a command, then the lines it prints." },
  ),
};

const isColor = (name: string): name is (typeof COLORS)[number] =>
  COLORS.some((color) => color === name);

/** `{green ✓} done` as code pieces: each braced run in its color, the rest plain. */
const pieces = (line: string): CodePiece[] =>
  line
    .split(/(\{[a-z]+ [^}]*\})/)
    .filter((part) => part !== "")
    .map((part) => {
      const [, color = "", run = ""] = /^\{([a-z]+) ([^}]*)\}$/.exec(part) ?? [];

      return isColor(color) ? [color, run] : part;
    });

const session = (lines: Values<typeof params>["lines"]): TerminalCommand[] => {
  const commands: TerminalCommand[] = [];

  for (const [i, line] of lines.entries()) {
    const last = commands.at(-1);

    if (line.kind === "command") commands.push({ cmd: line.text });
    else if (last)
      commands[commands.length - 1] = {
        ...last,
        output: [...(last.output ?? []), pieces(line.text)],
      };
    else
      throw new Error(
        `lines[${i}] is output before any command. Start the session with a command.`,
      );
  }

  return commands;
};

export default function build(p: Values<typeof params> = defaults(params)): string {
  const frame = rect(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN);
  const shell = appWindow(frame, { theme, title: p.window, dots: "traffic" });

  const typed = terminal(session(p.lines), {
    theme,
    x: shell.body.x + 32,
    y: shell.body.y + 20,
    fontSize: 20,
    lineHeight: 1.75,
    font: mono,
  });

  return render(
    {
      width: W,
      height: H,
      title: p.title,
      desc: p.desc,
      duration: typed.span.end + 2,
      reducedMotion: { at: typed.span.end + 1 },
      css,
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <g fontFamily={mono}>{shell.node}</g>
      {typed.node}
    </>,
  );
}
