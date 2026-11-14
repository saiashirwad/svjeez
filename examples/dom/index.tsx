import { google } from "@svjeez/fonts";
import { Dom, size, snapshots, type Action } from "@svjeez/dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render, span, variables } from "svjeez";
import { tailwind } from "./tailwind.ts";
import { pieces } from "./ui.tsx";

// Real shadcn components rendered by React, laid out by Chromium with Tailwind 4, then drawn as SVG.
// Each card is a live page that runs its steps in order: the sign-in card is typed into, focused and hovered, and
// every state is read off it.
// The snapshots are kept in snapshots.json, so a build without changes never starts Chromium.
const geist = await google.family("Geist", [400, 500, 600]);
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const html = {
  signIn: pieces.login(false),
  failed: pieces.login(true),
  open: pieces.pr(false),
  merged: pieces.pr(true),
};

// The sign-in card's steps as plain data, so they are part of the inputs: changing one reads the page again.
const login = [
  { snap: "idle" },
  { fill: ["[data-part=email]", "sai@exmaple.com"] },
  { snap: "typed" },
  { fill: ["[data-part=password]", "hunter2hunter2"] },
  { snap: "password" },
  { hover: "[data-part=submit]" },
  { snap: "hovered" },
  // The server says no: the same card, re-rendered, with the pointer moved off.
  { render: html.failed },
  { move: [0, 0] },
  { snap: "failed" },
] as const satisfies readonly Action[];

const { idle, typed, password, hovered, failed, open, merged } = await snapshots(
  here("snapshots.json"),
  { inputs: { html, login, theme: readFileSync(here("theme.css"), "utf8") }, fonts: [geist] },
  async (dom) => {
    const css = await tailwind(Object.values(html));
    const signIn = await dom.mount(html.signIn, { css });
    const pr = await dom.mount(html.open, { css });

    return {
      ...(await signIn.steps(login)),
      ...(await pr.steps({ open: null, merged: { html: html.merged } })),
    };
  },
);

const D = 9;
const GAP = 16;
const MARGIN = 24;
// The pull request card turns merged, then opens again.
const prStates = [open, merged, open];
// Each fill types in over its span: about a second per field.
const signIn = [
  idle,
  [typed, span(0.5, 1.1)],
  [password, span(1.9, 1)],
  [hovered, span(3.2, 0.35)],
  [failed, span(4.1, 0.7)],
  [idle, span(6.6, 0.8)],
] as const;
const left = size(signIn);
const right = size(prStates);
const W = MARGIN * 2 + left.width + GAP + right.width;
const H = MARGIN * 2 + Math.max(left.height, right.height);
const { vars, css } = variables({ backdrop: "#09090b" }, { backdrop: "#f4f4f5" });

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      css,
      title: "shadcn components changing state",
      desc: "A sign-in card has an email typed into it, then a password, the button hovered and an error shown, and both fields are deleted; a pull request card turns merged, its diff stat counts up and it grows a row of passing checks, then opens again.",
    },
    <>
      <rect width={W} height={H} fill={vars.backdrop} />
      <Dom states={signIn} fonts={[geist]} x={MARGIN} y={MARGIN} />
      <Dom
        states={prStates}
        fonts={[geist]}
        at={[2, 6]}
        over={0.7}
        x={MARGIN + left.width + GAP}
        y={MARGIN}
      />
    </>,
  );
}
