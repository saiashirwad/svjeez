import { ease, motion, render } from "svjeez";
import { chick } from "../site/lib/chick";

export const hop = motion({ y: 60 })
  .to({ y: 0 }, { at: 0.4, over: 0.4 }, ease.out)
  .to({ y: 60 }, { at: 0.8, over: 0.4 }, ease.in);

export default () =>
  render(
    { width: 208, height: 240, duration: 2,
      title: "A chick hops" },
    chick({ body: hop }),
  );
