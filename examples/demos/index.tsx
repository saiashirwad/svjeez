import { google } from "@svjeez/fonts";
import { Dom, duration, loop, size } from "@svjeez/dom";
import { recordings } from "@svjeez/dom/vite";
import { fileURLToPath } from "node:url";
import { render, variables } from "svjeez";

// Real React components from an app, filmed. cards.demo.tsx says what happens to each; recordings() renders them
// through the app's own Vite config (React, Tailwind 4) in Chromium and reads every state back as SVG.
// snapshots.json keeps the recording: it is made again only when a demo or a file it imports changes.
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));
const geist = await google.family("Geist", [400, 500, 600]);

const demos = await recordings<typeof import("./cards.demo.tsx")>(here("cards.demo.tsx"), {
  cache: here("snapshots.json"),
  fonts: [geist],
});

// Each flow ends back in its first state, so the loop has no jump.
const signIn = loop(demos.signIn);
const pullRequest = loop(demos.pullRequest);

const GAP = 16;
const MARGIN = 24;
const left = size(signIn);
const right = size(pullRequest);
const W = MARGIN * 2 + left.width + GAP + right.width;
const H = MARGIN * 2 + Math.max(left.height, right.height);
const { vars, css } = variables({ backdrop: "#09090b" }, { backdrop: "#f4f4f5" });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: Math.max(duration(signIn), duration(pullRequest)),
      css,
      title: "React components, filmed from their demos",
      desc: "A sign-in form has an email and password typed in, then shows an error from the server; a pull request has auto-merge switched on, then merges.",
    },
    <>
      <rect width={W} height={H} fill={vars.backdrop} />
      <Dom states={signIn} fonts={[geist]} x={MARGIN} y={MARGIN} />
      <Dom states={pullRequest} fonts={[geist]} x={MARGIN + left.width + GAP} y={MARGIN} />
    </>,
  );
}
