import { describe, expect, test } from "bun:test";
import { restyleScene } from "../helpers/frames-restyle";

describe("restyle", () => {
  test("the reduced-motion freeze stays where posters read it", () => {
    const svg = restyleScene({ at: 2.5 });
    expect(svg).toMatch(/animation-delay:-2\.5s!important/);
  });
});
