import { google } from "@svjeez/fonts";
import {
  Dom,
  duration,
  fill,
  hover,
  html as rerender,
  size,
  snap,
  snapshots,
  wait,
  type Flow,
} from "@svjeez/dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render, variables } from "svjeez";
import { tailwind } from "./tailwind.ts";
import { pieces } from "./ui.tsx";

// Real shadcn components rendered by React, laid out by Chromium with Tailwind 4, then drawn as SVG.
// Each card is a live page that runs a flow in order: the sign-in card is typed into, focused and hovered, and
// every state is read off it. Timing is relative: each snap moves in from where the last move ended, plus waits.
// The snapshots are kept in snapshots.json, so a build without changes never starts Chromium.
const geist = await google.family("Geist", [400, 500, 600]);
const here = (name: string) => fileURLToPath(new URL(name, import.meta.url));

const html = {
  signIn: pieces.login(false),
  failed: pieces.login(true),
  open: pieces.pr(false),
  merged: pieces.pr(true),
};

// A sub-flow any sign-in card can reuse: each field types in over about a second.
const login = (email: string, password: string): Flow => [
  fill("email", email),
  snap("typed", { over: 1.1 }),
  wait(0.3),
  fill("password", password),
  snap("password", { over: 1 }),
];

const signIn: Flow = [
  snap("idle"),
  wait(0.5),
  ...login("sai@exmaple.com", "hunter2hunter2"),
  wait(0.3),
  hover("submit"),
  snap("hovered", { over: 0.35 }),
  wait(0.55),
  // The server says no: the same card, re-rendered, which leaves hover and focus behind.
  rerender(html.failed),
  snap("failed", { over: 0.7 }),
  wait(1.8),
  // Then back to the start, and both fields delete.
  rerender(html.signIn),
  snap("idle", { over: 0.8 }),
  wait(1.6),
];

// The pull request card as data: it turns merged, then opens again.
const pr = [
  { snap: "open" },
  { wait: 2 },
  { html: html.merged },
  { snap: "merged", over: 0.7 },
  { wait: 3.3 },
  { html: html.open },
  { snap: "open", over: 0.7 },
] as const satisfies Flow;

// snapshots.json records the markup and every instruction, so changing one reads the pages again. The theme is
// read by Tailwind, out of its sight.
const cards = await snapshots(
  here("snapshots.json"),
  {
    inputs: readFileSync(here("theme.css"), "utf8"),
    fonts: [geist],
    css: (markup) => tailwind([markup]),
  },
  async (dom) => ({
    signIn: await dom.run(html.signIn, signIn),
    pr: await dom.run(html.open, pr),
  }),
);

const D = Math.max(duration(cards.signIn), duration(cards.pr));
const GAP = 16;
const MARGIN = 24;
const left = size(cards.signIn);
const right = size(cards.pr);
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
      <Dom states={cards.signIn} fonts={[geist]} x={MARGIN} y={MARGIN} />
      <Dom states={cards.pr} fonts={[geist]} x={MARGIN + left.width + GAP} y={MARGIN} />
    </>,
  );
}
