/** @jsxImportSource svjeez/scene */
import { Shape, circle, ease, enter, scene, span } from "svjeez/scene";

export default scene({ size: [320, 120], duration: 2, title: "Hello" }, () => (
  <Shape
    geometry={circle(30)}
    at={[160, 60]}
    anchor="center"
    fill="#3EE6D6"
    motion={enter(span(0, 1), { from: { scale: 0 }, curve: ease.pop })}
  />
));
