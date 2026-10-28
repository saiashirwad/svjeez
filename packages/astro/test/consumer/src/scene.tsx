/** @jsxImportSource svjeez */
import { enter, render } from "svjeez";

export default () =>
  render(
    { width: 320, height: 120, duration: 2, title: "Consumer" },
    <text x="20" y="70" fontSize={40} animation={enter({ at: 0, over: 1 }, { opacity: 0 })}>
      Hello
    </text>,
  );
