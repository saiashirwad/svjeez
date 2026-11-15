import { ease, motion, render } from "svjeez";
import { SQUASH, blip } from "../site/lib/blip";

export const frame = { width: 208, height: 300, duration: 1.5, title: "Blip hops", css: SQUASH };

export const hop = motion({ y: 100 })
  .at(0.4).to({ y: 10 }, 0.4, ease.out)
  .to({ y: 100 }, 0.4, ease.in);

export default () =>
  render(frame, blip({
    body: hop,
  }));
