import { ease, motion } from "svjeez";

import { theme } from "../style";
import { CHICK, sx, sy } from "../site/lib/chick";

// The moves the explainer's snippet calls. Each is one hop long, a second and a half, and starts and ends at rest.
// The hop itself leaves the ground at 0.4s, peaks at 0.8s and lands at 1.2s.

export const PERIOD = 1.5;

/** A deep crouch, a tall stretch on takeoff and a flat squash on landing. */
export const boing = () =>
  motion({ [sx]: 1, [sy]: 1 })
    .at(0.1)
    .to({ [sx]: 1.4, [sy]: 0.5 }, 0.3, ease.out)
    .to({ [sx]: 0.7, [sy]: 1.38 }, 0.12, ease.out)
    .to({ [sx]: 0.9, [sy]: 1.12 }, 0.25)
    .to({ [sx]: 0.85, [sy]: 1.25 }, 0.35)
    .to({ [sx]: 1.55, [sy]: 0.45 }, 0.1, ease.out)
    .to({ [sx]: 0.9, [sy]: 1.12 }, 0.13, ease.out)
    .to({ [sx]: 1, [sy]: 1 }, 0.15, ease.pop);

/** The antenna bulb flashes through five hues and settles back to yellow. */
export const flash = () =>
  motion({ fill: CHICK.yellow })
    .at(0.35)
    .to({ fill: theme.base08 }, 0.1)
    .to({ fill: theme.base0C }, 0.2)
    .to({ fill: theme.base0B }, 0.2)
    .to({ fill: theme.base0E }, 0.2)
    .to({ fill: theme.base08 }, 0.2)
    .to({ fill: CHICK.yellow }, 0.25);

/** The eyes dart left, up as it leaves the ground, right at the top, and down on landing. */
export const glance = () =>
  motion({ x: 0, y: 0 })
    .at(0.15)
    .to({ x: -14, y: 0 }, 0.1, ease.out)
    .wait(0.2)
    .to({ x: 0, y: -9 }, 0.1, ease.out)
    .wait(0.3)
    .to({ x: 14, y: 0 }, 0.1, ease.out)
    .wait(0.15)
    .to({ x: 0, y: 7 }, 0.1, ease.out)
    .to({ x: 0, y: 0 }, 0.3);

/** One foot held out to its side, stepping down and up; the other steps the opposite way. */
const pedal = (side: number, down: boolean) => {
  let m = motion({ x: 0, y: 0 })
    .at(0.35)
    .to({ x: side, y: down ? 18 : 2 }, 0.1, ease.out);

  for (let i = 0; i < 5; i++) {
    down = !down;
    m = m.to({ x: side, y: down ? 18 : 2 }, 0.13, ease.inOut);
  }

  return m.to({ x: 0, y: 0 }, 0.2);
};

/** Feet appear, and run in the air. */
export const kick = () => ({ left: pedal(-18, true), right: pedal(18, false) });

/** A full turn in the air. */
export const flip = () => motion({ rotate: 0 }).at(0.4).to({ rotate: 360 }, 0.75, ease.inOut);
