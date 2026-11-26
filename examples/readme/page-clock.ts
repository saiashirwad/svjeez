// The README's page-clock diagram, drawn by @svjeez/mermaid.
import { show } from "../mermaid-types/show";

export default show(
  "A page takes over a scene clock",
  `sequenceDiagram
  participant Scene as scene.tsx
  participant SVG as scene.svg
  participant Page as page.ts
  Scene->>SVG: clock("open", span(1, 0.5))
  Note over SVG: in an img, the span plays by itself
  Page->>SVG: mount(svg).clock("open")
  Page->>SVG: play() / reverse() on click
  Page->>SVG: follow(scrolled(card))`,
);
