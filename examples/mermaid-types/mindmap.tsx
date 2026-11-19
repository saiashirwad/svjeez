import { show } from "./show";

export default show(
  "Mindmap",
  `mindmap
  root((svjeez))
    "\`**Scenes**\`"
      ::icon(fa fa-cube)
      Shapes
      Text
      Motion
    Diagrams
      Flowchart
      Sequence
      Mermaid
    Output
      SVG:::done
      Video
      PNG frames`,
);
