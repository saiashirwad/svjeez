import { google } from "@svjeez/fonts";
import {
  Dom,
  fill,
  hover,
  move,
  render as rerender,
  size,
  snap,
  snapshots,
  type Flow,
} from "@svjeez/dom";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { render, span, variables } from "svjeez";
import { tailwind } from "./tailwind.ts";
import { pieces } from "./ui.tsx";

// Real shadcn components rendered by React, laid out by Chromium with Tailwind 4, then drawn as SVG.
// Each card is a live page that runs a flow in order: the sign-in card is typed into, focused and hovered, and
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

// A sub-flow any sign-in card can reuse: each field types in over about a second, starting at `at`.
async function* login(email: string, password: string, at: number) {
  yield fill("[data-part=email]", email);
  yield snap("typed", span(at, 1.1));
  yield fill("[data-part=password]", password);
  yield snap("password", span(at + 1.4, 1));
}

async function* signIn() {
  yield snap("idle");
  yield* login("sai@exmaple.com", "hunter2hunter2", 0.5);
  yield hover("[data-part=submit]");
  yield snap("hovered", span(3.2, 0.35));
  // The server says no: the same card, re-rendered, with the pointer moved off.
  yield rerender(html.failed);
  yield move(0, 0);
  yield snap("failed", span(4.1, 0.7));
  // Then back to the start, and both fields delete.
  yield rerender(html.signIn);
  yield snap("idle", span(6.6, 0.8));
}

// The pull request card as data: it turns merged, then opens again.
const pr = [
  { snap: "open" },
  { render: html.merged },
  { snap: "merged", at: 2, over: 0.7 },
  { render: html.open },
  { snap: "open", at: 6, over: 0.7 },
] as const satisfies Flow;

// snapshots.json records the markup and every instruction, so changing one reads the pages again. The theme is
// read by Tailwind, out of its sight.
let built: Promise<string> | undefined;
const sheet = () => (built ??= tailwind(Object.values(html)));

const cards = await snapshots(
  here("snapshots.json"),
  { inputs: readFileSync(here("theme.css"), "utf8"), fonts: [geist] },
  async (dom) => ({
    signIn: await (await dom.mount(html.signIn, { css: sheet })).run(signIn()),
    pr: await (await dom.mount(html.open, { css: sheet })).run(pr),
  }),
);

const D = 9;
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
