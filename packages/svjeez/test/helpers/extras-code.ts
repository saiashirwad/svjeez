import { code } from "svjeez/extras";

export const sample = () =>
  code([[{ content: "ab" }, { content: "cd" }], [{ content: "x cd" }]], {
    x: 10,
    y: 20,
    fontSize: 10,
    lineHeight: 2,
    advance: 6,
  });
