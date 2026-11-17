import { ease, motion, render, span } from "svjeez";

const rise = motion({ y: 40 }).to({ y: 0 }, span(0, 1.2), ease.bezier(0.2, 0.8, 0.2, 1));
const spin = motion({ rotate: 0 }).to({ rotate: 90 }, span(0.5, 1.5), ease.out);

export default () =>
  render(
    { width: 400, height: 240, duration: 3, title: "Two shapes" },
    <>
      <rect width={400} height={240} fill="#15131A" />
      <circle cx={120} cy={120} r={30} fill="#FF5D8F" animation={rise} />
      <rect x={220} y={90} width={80} height={60} fill="#3EE6D6" animation={spin} />
    </>,
  );
