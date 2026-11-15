import { ease, motion, render } from "svjeez";
import { chick } from "../site/lib/chick";

export const frame = { width: 208, height: 240, duration: 1.2, title: "A chick hops" };

export const hop = motion({ y: 60 })
  .at(0.4).to({ y: 0 }, 0.4, ease.out)
  .rewind(0.4, ease.in);

export default () => render(frame, chick({ body: hop }));
