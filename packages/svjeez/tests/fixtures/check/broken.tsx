/** @jsxImportSource svjeez/scene */
import { Shape, rect, scene } from "svjeez/scene";

// A scene that throws while it builds, for `svjeez check` to report as a finding.
const width = (): number => {
  throw new Error("width is not known yet");
};

export default scene({ size: [100, 60], duration: 2, title: "Broken" }, () => (
  <Shape geometry={rect(width(), 10)} fill="#FF0000" />
));
