import { render } from "svjeez";

// A scene with one fault for `svjeez check`: a dot placed where the canvas never shows it.
export default () =>
  render(
    { width: 100, height: 60, duration: 1, title: "Off canvas" },
    <>
      <rect width={100} height={60} fill="#111" />
      <circle cx={300} cy={30} r={6} fill="#fff" />
    </>,
  );
