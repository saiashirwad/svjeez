import { show } from "./show";

export default show(
  "Gantt chart",
  `gantt
  title Launch plan
  dateFormat YYYY-MM-DD
  excludes weekends
  section Design
  Research        :done, r1, 2026-03-02, 4d
  Wireframes      :active, w1, after r1, 5d
  section Build
  API             :crit, api, after w1, 8d
  Frontend        :fe, after w1, 10d
  section Ship
  Beta            :milestone, beta, after api fe, 0d
  Launch          :crit, after beta, 2d`,
);
