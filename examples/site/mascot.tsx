import { ease, motion, render } from "svjeez";
import { CHICK, chick } from "./lib/chick";

// The header's chick, alive. It sits exactly as the favicon draws it for most of a 12 second loop, blinks, hops once
// with its antenna bulb wobbling behind, blinks twice, and lights its bulb for a moment. Reduced motion holds frame 0,
// which is the favicon.

const D = 12;

// A crouch, up, and down.
const body = motion({ y: 0 })
  .at(5.8)
  .to({ y: 2 }, 0.14, ease.out)
  .to({ y: -5 }, 0.2, ease.out)
  .to({ y: 0 }, 0.2, ease.in);

// The bulb lags a beat behind the body on its stem and wobbles to rest after the landing.
const bulb = motion({ y: 0 })
  .at(5.94)
  .to({ y: 3 }, 0.16)
  .to({ y: -2 }, 0.22, ease.inOut)
  .to({ y: 3 }, 0.12, ease.in)
  .to({ y: 0 }, 0.45, ease.pop);

const glow = motion({ fill: CHICK.yellow })
  .at(10.8)
  .to({ fill: "#FFEC99" }, 0.15)
  .wait(0.25)
  .to({ fill: CHICK.yellow }, 0.6);

export default () =>
  render(
    {
      width: 208,
      height: 208,
      duration: D,
      title: "svjeez chick",
      desc: "The yellow svjeez chick sits still, blinks, hops once with its antenna bulb wobbling, blinks twice and lights its bulb.",
      reducedMotion: { at: 0 },
    },
    <g transform="translate(104 104) scale(1.4) translate(-104 -95.5)">
      {chick({ blinks: [2.6, 8.9, 9.25], body, bulb, glow })}
    </g>,
  );
