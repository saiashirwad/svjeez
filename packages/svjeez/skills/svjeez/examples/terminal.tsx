/** @jsxImportSource svjeez */
/** @jsxRuntime automatic */
import { rect, render } from "svjeez";
import { adaptive, appWindow, terminal, systemDark, systemLight } from "svjeez/extras";

// A shell session typed out in a window, in a theme that follows the viewer's light or dark mode.
const { theme, css: colors } = adaptive({ dark: systemDark, light: systemLight });
const css = `${colors}\n.mono,.mono text{font-family:ui-monospace,Menlo,Consolas,monospace;font-variant-ligatures:none}`;

const shell = appWindow(rect(24, 24, 560, 190), {
  theme,
  title: "~/hello",
  dots: "traffic",
  class: "mono",
});

const session = terminal(
  [
    { cmd: "npm i svjeez", output: [[["muted", "added 1 package"]]] },
    { cmd: "npx tsx hello.tsx", output: [[["green", "✓"], " wrote hello.svg"]] },
  ],
  { theme, x: shell.body.x + 24, y: shell.body.y + 16, fontSize: 15, lineHeight: 1.7 },
);

export default function build(): string {
  return render(
    {
      width: 608,
      height: 238,
      // session.end is when the last line lands. Hold it for a beat before the loop restarts.
      duration: session.end + 2,
      title: "Install and run",
      desc: "Two commands typed into a terminal window, each followed by its output.",
      reducedMotion: { at: session.end + 1 },
      css,
    },
    <>
      <rect width="100%" height="100%" fill={theme.base01} />
      {shell.node}
      <g class="mono">{session.node}</g>
    </>,
  );
}
