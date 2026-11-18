import { Clip, motion, render } from "svjeez";

export default () =>
  render(
    { width: 200, height: 100, duration: 4, title: "Cue", css: "@keyframes unused{to{opacity:0}}" },
    <>
      <text x={20} y={50} fill="#38bdf8">
        first label
      </text>
      <Clip at={0.2} over={0.3}>
        <text
          id="caption"
          fill="#f472b6"
          x={20}
          y={50}
          animation={motion({ opacity: 0 }).set({ opacity: 1 }, 0.013).set({ opacity: 0 }, 0.2)}
        >
          second label
        </text>
      </Clip>
    </>,
  );
