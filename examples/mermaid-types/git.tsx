import { show } from "./show";

export default show(
  "Git graph",
  `gitGraph
  commit
  commit tag: "v1.0"
  branch feature
  checkout feature
  commit
  commit
  checkout main
  commit type: HIGHLIGHT
  merge feature tag: "v1.1"
  branch hotfix
  commit type: REVERSE
  checkout main
  merge hotfix`,
);
