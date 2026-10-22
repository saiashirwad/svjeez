import { Scene, anim, g, rect, revealWindow } from "svg-motion";

const doc = new Scene({
  width: 100,
  height: 100,
  duration: 10,
  title: "JSX animation smoke test",
});
doc.add(
  <g animation={anim("box", revealWindow({ in: [1, 2], out: [8, 9], from: { opacity: 0, y: 8 }, to: { opacity: 1, y: 0 } }))}>
    <rect x={10} y={20} width={30} height={40} fill="#123" />
  </g>,
);
console.log(doc.render());
