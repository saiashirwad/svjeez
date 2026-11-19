import { show } from "./show";

export default show(
  "Radar chart",
  `radar-beta
  title Team skills
  axis design["Design"], code["Code"], speed["Speed"], docs["Docs"], tests["Tests"], ux["UX"]
  curve alice["Alice"]{4, 5, 3, 2, 4, 4}
  curve bob["Bob"]{2, 3, 5, 4, 3, 2}
  curve cara["Cara"]{design: 5, code: 2, speed: 2, docs: 5, tests: 3, ux: 5}
  max 5
  graticule polygon
  ticks 5`,
);
