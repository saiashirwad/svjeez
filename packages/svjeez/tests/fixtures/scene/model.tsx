/** @jsxImportSource svjeez/scene */
import { Shape, circle, rect, scene, show, span } from "svjeez/scene";

// The fragment proves the pragma: svjeez's own runtime makes a different fragment, which scene() refuses.
export default scene({ size: [100, 60], duration: 2, title: "Model" }, () => (
  <>
    <Shape geometry={rect(100, 60)} fill="#101010" />
    <Shape
      geometry={circle(10)}
      at={[50, 30]}
      anchor="center"
      fill="#3EE6D6"
      opacity={show(span(0.5, 1))}
    />
  </>
));
