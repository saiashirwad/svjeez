import { Clip, chain, ease, motion, render, span, stagger } from "svjeez";

const [rise, fall] = chain(span(0, 0.6), 0.6);
const bars = stagger(rise, 20, 0.08);
const low = { draw: 0.15, opacity: 0.35 };

const pulse = motion(low)
  .to({ draw: 1, opacity: 1 }, rise, ease.inOut)
  .to(low, fall, ease.inOut)
  .loop(fall.end);

export default () =>
  render(
    { width: 480, height: 280, duration: fall.end, title: "A wave" },
    <g stroke="#FF5A5F" strokeWidth={10} strokeLinecap="round">
      {bars.map((bar, i) => (
        <Clip at={bar.at % fall.end}>
          <path d={`M${50 + i * 20} 240V40`} animation={pulse} />
        </Clip>
      ))}
    </g>,
  );
