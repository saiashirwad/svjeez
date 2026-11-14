/** @jsxImportSource svjeez */
import { ease, motion, render } from "svjeez";

const rise = motion({ y: 40 }).to({ y: 0 }, 1.2, ease.bezier(0.2, 0.8, 0.2, 1));
const spin = motion({ rotate: 0 }).at(0.5).to({ rotate: 90 }, 1.5, ease.out);

export default () =>
  render(
    { width: 400, height: 240, duration: 3, title: "Two shapes" },
    <>
      <rect width={400} height={240} fill="#15131A" />
      <circle cx={120} cy={120} r={30} fill="#FF5D8F" animation={rise} />
      <rect x={220} y={90} width={80} height={60} fill="#3EE6D6" animation={spin} />
    </>,
  );
