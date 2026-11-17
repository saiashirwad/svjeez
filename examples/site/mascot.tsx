import { chain, ease, motion, render, span } from "svjeez";
import { BLIP, blip } from "./lib/blip";

// Blip in the header, alive. It sits exactly as the favicon draws it for most of a 12 second loop, blinks, hops once
// with its antenna bulb wobbling behind, blinks twice, and lights its bulb for a moment. Reduced motion holds frame 0,
// which is the favicon.

const D = 12;

// A crouch, up, and down.
const [crouch, up, down] = chain(span(5.8, 0.14), 0.2, 0.2);

const body = motion({ y: 0 })
  .to({ y: 2 }, crouch, ease.out)
  .to({ y: -5 }, up, ease.out)
  .to({ y: 0 }, down, ease.in);

// The bulb lags a beat behind the body on its stem and wobbles to rest after the landing.
const [sag, rise, drop, settle] = chain(span(5.94, 0.16), 0.22, 0.12, 0.45);

const bulb = motion({ y: 0 })
  .to({ y: 3 }, sag)
  .to({ y: -2 }, rise, ease.inOut)
  .to({ y: 3 }, drop, ease.in)
  .to({ y: 0 }, settle, ease.pop);

const light = span(10.8, 0.15);

const glow = motion({ fill: BLIP.yellow })
  .to({ fill: "#FFEC99" }, light)
  .to({ fill: BLIP.yellow }, light.next(0.6, 0.25));

export default () =>
  render(
    {
      width: 208,
      height: 208,
      duration: D,
      title: "Blip",
      desc: "Blip, the svjeez mascot, sits still, blinks, hops once with its antenna bulb wobbling, blinks twice and lights its bulb.",
      reducedMotion: { at: 0 },
    },
    <g transform="translate(104 104) scale(1.4) translate(-104 -95.5)">
      {blip({ blinks: [2.6, 8.9, 9.25], body, bulb, glow })}
    </g>,
  );
