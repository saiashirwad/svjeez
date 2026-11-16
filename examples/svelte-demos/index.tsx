import { google } from "@svjeez/fonts";
import { Dom, duration, loop, size } from "@svjeez/dom";
import { recordings } from "@svjeez/dom/vite";
import { fileURLToPath } from "node:url";
import { render, variables } from "svjeez";

// A real Svelte 5 component from an app, filmed. notifications.demo.ts says what happens to it; recordings() renders
// it through the app's own Vite config (Svelte, Tailwind 4) in Chromium and reads every state back as SVG.
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const geist = await google.family("Geist", [400, 500, 600]);

const demos = await recordings<typeof import("./notifications.demo.ts")>(here("notifications.demo.ts"), {
  cache: here("snapshots.json"),
  fonts: [geist],
});

const notifications = loop(demos.notifications);
const MARGIN = 24;
const card = size(notifications);
const W = card.width + 2 * MARGIN;
const H = card.height + 2 * MARGIN;
const { vars, css } = variables({ dark: { backdrop: "#09090b" }, light: { backdrop: "#f4f4f5" } });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: duration(notifications),
      css,
      title: "A Svelte settings card, filmed from its demo",
      desc: "Three notification switches flip one by one while the count of switches on follows, then the card is saved.",
    },
    <>
      <rect width={W} height={H} fill={vars.backdrop} />
      <Dom states={notifications} fonts={[geist]} x={MARGIN} y={MARGIN} />
    </>,
  );
}
