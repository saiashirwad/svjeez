import { render } from "svg-motion";
import { lanes } from "svjeez/extras";
import { CSS, theme } from "./kit";

const M = 24;
const run = lanes(
  { lanes: { lead: "Lead", build: { label: "Build", role: "tool" } }, spans: [{ lane: "lead", from: 0, to: 1, label: "plan" }, { lane: "build", from: 1, to: 4, label: "editing" }], events: [{ lane: "build", at: 2, label: "TEST" }], links: [{ from: "lead", to: "build", at: 1 }] },
  { theme, x: M, y: M, class: "mono", fontSize: 13, scale: 80, play: true },
);

export default function build(): string {
  return render(
    { width: run.bounds.w + 2 * M, height: run.bounds.h + 2 * M, duration: 6, title: "Lanes", desc: "Two lanes on a time axis: the lead hands off to build, which edits for three seconds and runs a test.", css: CSS, reducedMotion: { at: 4.5 } },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      {run.node}
    </>,
  );
}
