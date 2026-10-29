import { render } from "svjeez";
import { defaults, number, type Handles, type Values } from "svjeez/params";

export const params = {
  x: number(100, { min: 20, max: 380, step: 1, label: "x" }),
};

export const handles: Handles<typeof params> = (p) => ({ x: { x: p.x, y: 120 } });

export default (p: Values<typeof params> = defaults(params)) =>
  render(
    { width: 400, height: 240, duration: 2, title: "One dot" },
    <>
      <rect width={400} height={240} fill="#15131A" />
      <circle cx={p.x} cy={120} r={20} fill="#FF5D8F" />
    </>,
  );
