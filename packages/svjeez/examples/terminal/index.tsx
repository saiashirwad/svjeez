import { rect, render } from "svjeez";
import { adaptive, terminal, systemLight, systemDark, appWindow } from "svjeez/extras";

const W = 960;
const H = 440;

const { theme, css } = adaptive({ light: systemLight, dark: systemDark });
const frame = rect(80, 50, 800, 340);
const shell = appWindow(frame, { theme, title: "~/hello", dots: "traffic", class: "mono" });

const session = terminal(
  [
    { cmd: "bun add svjeez", output: [[["muted", "installed svjeez@0.2.0"]]] },
    {
      cmd: "bun run build",
      output: [
        [["green", "✓"], " dist/explainer.svg  ", ["muted", "29.4 KB"]],
        [["green", "✓"], " dist/terminal.svg   ", ["muted", " 6.0 KB"]],
      ],
    },
    { cmd: "open dist/explainer.svg" },
  ],
  { theme, x: shell.body.x + 32, y: shell.body.y + 20, fontSize: 16, lineHeight: 1.75 },
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      title: "Terminal",
      desc: "Installing svjeez and building the examples, typed out in a terminal that follows the viewer's light or dark mode.",
      duration: session.end + 2,
      reducedMotion: { at: session.end + 1 },
      css: [css, ".mono,.mono text{font-family:'JetBrains Mono','SF Mono',ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none}"].join("\n"),
    },
    <>
      <rect width={W} height={H} fill={theme.base00} />
      {shell.node}
      <g class="mono">{session.node}</g>
    </>,
  );
}
