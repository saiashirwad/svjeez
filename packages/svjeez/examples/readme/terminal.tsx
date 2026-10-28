import { rect, render } from "svjeez";
import { terminal, appWindow } from "svjeez/extras";
import { CSS, theme } from "./kit";

const shell = appWindow(rect(20, 20, 400, 170), { theme, title: "~/hello", dots: "traffic", class: "mono" });
const session = terminal(
  [
    { cmd: "bun add svjeez", output: [[["muted", "installed svjeez@0.2.0"]]] },
    { cmd: "bun run build", output: [[["green", "✓"], " dist/hello.svg"]] },
  ],
  { theme, x: shell.body.x + 20, y: shell.body.y + 16, fontSize: 14, lineHeight: 1.7 },
);

export default function build(): string {
  return render(
    { width: 440, height: 210, duration: session.end + 2, title: "Terminal", desc: "Two commands typed into a terminal window, each followed by its output.", css: CSS, reducedMotion: { at: session.end + 1 } },
    <>
      <rect width="100%" height="100%" fill={theme.base01} />
      {shell.node}
      <g class="mono">{session.node}</g>
    </>,
  );
}
