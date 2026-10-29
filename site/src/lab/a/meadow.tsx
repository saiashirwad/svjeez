import { color, count, defaults, easing, number, seconds } from "svjeez/params";
import { ease, motion, render } from "svjeez";

export const params = {
  sky: color("#BFE6FF"),
  sun: color("#FFC23D"),
  petal: color("#FF5D8F"),
  grass: color("#3C9D5D"),
  flowers: count(5, { min: 1, max: 12, label: "how many" }),
  gap: number(85, { min: 16, max: 160, step: 1, label: "px apart" }),
  stagger: seconds(0.18, { max: 0.4, label: "s between flowers" }),
  beat: seconds(1, { min: 0.5, max: 3, step: 0.05, label: "s per pulse" }),
  rise: easing(ease.bezier(0.2, 0.8, 0.2, 1)),
  pop: easing(ease.bezier(0.3, 1.8, 0.5, 1)),
};

export default (p = defaults(params)) => {
  const sunrise = motion({ y: 160 }).to({ y: 0 }, 1.4, p.rise).at(5.2).to({ y: 160 }, 0.8, ease.in);
  const pulse = motion({ scale: 1 }).to({ scale: 1.3 }, 0.12).to({ scale: 1 }, 0.4).loop(p.beat);

  return render(
    { width: 480, height: 300, duration: 6, title: "Meadow" },
    <>
      <rect width={480} height={300} fill={p.sky} />
      <circle cx={360} cy={90} r={34} fill={p.sun} animation={sunrise} />
      {Array.from({ length: p.flowers }, (_, i) => (
        <g transform={`translate(${240 + (i - (p.flowers - 1) / 2) * p.gap} 240)`}>
          <g
            animation={motion({ y: 120 })
              .label("flower")
              .at(0.8 + i * p.stagger)
              .to({ y: 0 }, 0.6, p.pop)
              .at(4.8)
              .to({ y: 120 }, 0.4, ease.in)}
          >
            <path d="M0 0V-64" stroke={p.grass} strokeWidth={5} strokeLinecap="round" />
            <circle cy={-70} r={16} fill={p.petal} animation={pulse} />
          </g>
        </g>
      ))}
      <path d="M0 236Q120 206 240 236T480 236V300H0Z" fill={p.grass} />
    </>,
  );
};
