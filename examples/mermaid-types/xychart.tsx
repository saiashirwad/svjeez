import { show } from "./show";

export default show(
  "XY chart",
  `xychart-beta
  title "Monthly revenue"
  x-axis Month [jan, feb, mar, apr, may, jun]
  y-axis "Revenue (k$)" 0 --> 120
  bar "Revenue" [42, 55, 61, 78, 90, 104]
  line "Target" [50, 60, 70, 80, 90, 100]`,
);
