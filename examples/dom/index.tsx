import { google } from "@svjeez/fonts";
import { Morph, snapshotter, type Snapshot } from "@svjeez/dom";
import { render, show, span, variables } from "svjeez";
import { tailwind } from "./tailwind.ts";
import { pieces } from "./ui.tsx";

// Real shadcn components rendered by React, laid out by Chromium with Tailwind 4, then drawn as SVG.
// Each card is two snapshots, one per state; Morph turns one into the other.
const geist = await google.family("Geist", [400, 500, 600]);

const html = {
  signIn: pieces.login(false),
  failed: pieces.login(true),
  open: pieces.pr(false),
  merged: pieces.pr(true),
};

const shot = await snapshotter({ css: await tailwind(Object.values(html)), fonts: [geist] });
const signIn = await shot.html(html.signIn);
const failed = await shot.html(html.failed);
const open = await shot.html(html.open);
const merged = await shot.html(html.merged);

await shot.close();

const W = 920;
const H = 470;
const D = 8;
const HALF = D / 2;
const { vars, css } = variables({ backdrop: "#09090b" }, { backdrop: "#f4f4f5" });

/** `a` becomes `b` at `there`, then `b` goes back to `a` at `back`. The two halves meet at HALF, where both show `b`. */
const ThereAndBack = ({
  a,
  b,
  there,
  back,
  x,
  y,
}: {
  a: Snapshot;
  b: Snapshot;
  there: number;
  back: number;
  x: number;
  y: number;
}) => (
  <>
    <g animation={show(span(0, HALF), { fade: 0 })}>
      <Morph from={a} to={b} at={there} over={0.7} x={x} y={y} />
    </g>
    <g animation={show(span(HALF), { fade: 0 })}>
      <Morph from={b} to={a} at={back} over={0.7} x={x} y={y} />
    </g>
  </>
);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration: D,
      css,
      title: "shadcn components changing state",
      desc: "A sign-in card shows an error and its fields slide down to make room; a pull request card turns merged and grows a row of passing checks.",
    },
    <>
      <rect width={W} height={H} fill={vars.backdrop} />
      <ThereAndBack a={signIn} b={failed} there={1} back={5} x={24} y={24} />
      <ThereAndBack a={open} b={merged} there={1.6} back={5.6} x={24 + signIn.width + 16} y={24} />
    </>,
  );
}
