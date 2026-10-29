import { ease, motion } from "svjeez";
import { code, shot, typewriter } from "svjeez/extras";
import { mono, theme } from "../style";
import { C, H, W, rise } from "./kit";

const FS = 40;
const CMD = "npm i svjeez";
const x = (W - mono.measure(`$ ${CMD}`, FS)) / 2;

const opening = typewriter(
  code([[["muted", "$"], " ", ["plain", CMD]]], {
    theme,
    font: mono,
    fontSize: FS,
    lineHeight: 1.4,
    x,
    y: H / 2 - 40,
  }),
  { at: 0.5, cps: 13, cursor: C.accent, blink: false },
);

const enterAt = opening.end + 0.35;
export const COLD = { at: 0, over: enterAt + 1.9 };

export const coldOpen = (
  <g animation={shot(COLD, { exit: "rise" })}>
    <g animation={motion({ y: 0 }).at(enterAt).to({ y: -28 }, 0.5, ease.inOut)}>
      {opening.node}
      <g animation={rise(enterAt + 0.15, 0.45, 10)}>
        <text x={x} y={H / 2 + 52} fontSize={20} fill={C.soft}>
          added 1 package in 0.4s
        </text>
      </g>
      <g animation={rise(enterAt + 0.55, 0.45, 10)}>
        <text x={x} y={H / 2 + 84} fontSize={20} fill={C.muted}>
          <tspan fill={C.accent}>0</tspan>
          {" dependencies. "}
          <tspan fill={C.accent}>0</tspan>
          {" bytes of runtime JS."}
        </text>
      </g>
    </g>
  </g>
);
