import { render, draw, enter, ease } from "svjeez";

export default () =>
  render(
    { width: 320, height: 200, duration: 4, title: "Arc" },
    <>
      <path
        d="M40 150C100 30 220 30 280 150"
        fill="none"
        stroke="#34C759"
        strokeWidth={6}
        animation={draw({ at: 0.3, over: 1.5 })}
      />
      <circle
        cx={160}
        cy={62}
        r={9}
        fill="#0A6CFF"
        animation={enter({ at: 1.6, over: 0.5 }, { scale: 0 }, ease.pop)}
      />
    </>,
  );
