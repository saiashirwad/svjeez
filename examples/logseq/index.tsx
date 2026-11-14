import {
  click,
  Dom,
  duration,
  fill,
  press,
  size,
  snap,
  snapshots,
  wait,
  type Flow,
} from "@svjeez/dom";
import { fileURLToPath } from "node:url";
import { render } from "svjeez";

// The Logseq web app, live: a page we don't own, opened in Chromium and driven like a person would. A block is
// typed on today's journal, the left sidebar opens, and search finds the block. Logseq follows the system's color
// scheme, so the drawing reads both and follows the viewer's. Its own Inter files come along in the snapshots.
// snapshots.json keeps every state, so builds never touch the network; SVJEEZ_DOM_REFRESH=1 reads the site again.
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const app = {
  url: "https://app.logseq.com/",
  // The whole page, so the search dialog, which Logseq portals onto <body>, is in the picture.
  root: "body",
  ready: "#journals .ls-block",
  width: 1100,
  height: 700,
  pad: 0,
};

const flow: Flow = [
  snap("journal"),
  wait(0.8),
  click(".block-add-button"),
  snap("editing", { over: 0.3 }),
  fill("textarea", "Drawing Logseq with svjeez"),
  snap("typed", { over: 1.4 }),
  wait(0.4),
  // Escape leaves the editor and selects the block; a second one clears the selection, so the block draws as text
  // again, in place, before anything moves.
  press("Escape"),
  press("Escape"),
  snap("saved", { over: 0.3 }),
  wait(0.3),
  click("#left-menu"),
  snap("sidebar", { over: 0.7 }),
  wait(0.8),
  press("ControlOrMeta+k"),
  snap("search", { over: 0.4 }),
  fill("input.cp__cmdk-search-input", "svjeez"),
  snap("found", { over: 0.9 }),
  wait(1.4),
  // The first Escape clears the query, the second closes the dialog.
  press("Escape"),
  press("Escape"),
  snap("journal", { over: 0.5 }),
  wait(0.8),
];

// The site changes under us, which the recording can't see: bump this to read it again on purpose.
const steps = await snapshots(here("snapshots.json"), { inputs: "logseq 1" }, (dom) =>
  dom.run(app, flow),
);

const { width, height } = size(steps);

export default function build(): string {
  return render(
    {
      width,
      height,
      duration: duration(steps),
      title: "The Logseq web app, driven and drawn",
      desc: "Logseq's journal page: a block is typed in, the left sidebar slides open, and search opens and finds the new block before closing again.",
    },
    <Dom states={steps} />,
  );
}
