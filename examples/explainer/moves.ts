import { chain, ease, motion, span } from "svjeez";

import { theme } from "../style";
import { BLIP, sx, sy } from "../site/lib/blip";

export const PERIOD = 1.5;

export const boing = () => {
  const [crouch, launch, rise, peak, land, squash, settle] = chain(
    span(0.1, 0.3),
    0.12,
    0.25,
    0.35,
    0.1,
    0.13,
    0.15,
  );

  return motion({ [sx]: 1, [sy]: 1 })
    .to({ [sx]: 1.4, [sy]: 0.5 }, crouch, ease.out)
    .to({ [sx]: 0.7, [sy]: 1.38 }, launch, ease.out)
    .to({ [sx]: 0.9, [sy]: 1.12 }, rise)
    .to({ [sx]: 0.85, [sy]: 1.25 }, peak)
    .to({ [sx]: 1.55, [sy]: 0.45 }, land, ease.out)
    .to({ [sx]: 0.9, [sy]: 1.12 }, squash, ease.out)
    .to({ [sx]: 1, [sy]: 1 }, settle, ease.pop);
};

export const flash = () => {
  const hues = [theme.base08, theme.base0C, theme.base0B, theme.base0E, theme.base08, BLIP.yellow];

  return chain(span(0.35, 0.1), 0.2, 0.2, 0.2, 0.2, 0.25).reduce(
    (m, beat, i) => m.to({ fill: hues[i]! }, beat),
    motion({ fill: BLIP.yellow }),
  );
};

export const glance = () => {
  const left = span(0.15, 0.1);
  const up = left.next(0.1, 0.2);
  const right = up.next(0.1, 0.3);
  const down = right.next(0.1, 0.15);

  return motion({ x: 0, y: 0 })
    .to({ x: -14, y: 0 }, left, ease.out)
    .to({ x: 0, y: -9 }, up, ease.out)
    .to({ x: 14, y: 0 }, right, ease.out)
    .to({ x: 0, y: 7 }, down, ease.out)
    .to({ x: 0, y: 0 }, down.next(0.3));
};

const pedal = (side: number, down: boolean) => {
  const [reach, ...strides] = chain(span(0.35, 0.1), 0.13, 0.13, 0.13, 0.13, 0.13);
  let m = motion({ x: 0, y: 0 }).to({ x: side, y: down ? 18 : 2 }, reach, ease.out);

  for (const stride of strides) {
    down = !down;
    m = m.to({ x: side, y: down ? 18 : 2 }, stride, ease.inOut);
  }

  return m.to({ x: 0, y: 0 }, strides[4]!.next(0.2));
};

export const kick = () => ({ left: pedal(-18, true), right: pedal(18, false) });

export const flip = () => motion({ rotate: 0 }).to({ rotate: 360 }, span(0.4, 0.75), ease.inOut);
