import { render, terminal, appWindow } from "svjeez";
import { rect } from "svjeez/geometry";

import { HEIGHT, MARGIN, WIDTH, css, mono, theme } from "../gallery-style";

const W = WIDTH;
const H = HEIGHT;

const frame = rect(MARGIN, MARGIN, W - 2 * MARGIN, H - 2 * MARGIN);
const shell = appWindow(frame, { theme, title: "~/app", dots: "traffic" });

const session = terminal(
  [
    { cmd: "bun install", output: [[["blue", "installed 142 packages"]]] },
    { cmd: "bun test", output: [[["green", "✓"], " 38 tests passed"]] },
    {
      cmd: "bun run build",
      output: [
        [["green", "✓"], " dist/app.js   ", ["magenta", "29.4 KB"]],
        [["green", "✓"], " dist/app.css  ", ["magenta", " 6.0 KB"]],
      ],
    },
  ],
  { theme, x: shell.body.x + 32, y: shell.body.y + 20, fontSize: 20, lineHeight: 1.75, font: mono },
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      title: "Terminal session",
      desc: "A terminal session installs dependencies, runs tests and builds, typed out line by line.",
      duration: session.span.end + 2,
      reducedMotion: { at: session.span.end + 1 },
      css,
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      <g fontFamily={mono}>{shell.node}</g>
      {session.node}
    </>,
  );
}
