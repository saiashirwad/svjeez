/** @jsxImportSource svjeez/scene */
import { Shape, circle, rect, scene, span, track } from "svjeez/scene";

// The fragment proves the pragma: svjeez's own runtime makes a different fragment, which scene() refuses.
export default scene({ size: [100, 60], duration: 2, title: "Model" }, () => (
  <>
    <Shape geometry={rect(100, 60)} fill="#101010" />
    <Shape
      geometry={circle(10)}
      at={[50, 30]}
      anchor="center"
      fill="#3EE6D6"
      opacity={track(0).to(1, span(0.5, 0.3)).to(0, span(1.2, 0.3))}
    />
  </>
));
