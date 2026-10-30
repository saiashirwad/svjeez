import { describe, expect, test } from "bun:test";
import { def, ease, motion } from "svjeez";
import { boil } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("effects", () => {
  test("a filter primitive channel compiles to SMIL animate attributes", () => {
    const svg = scene(<rect width={10} height={10} filter={boil()} />);
    expect(svg).toContain(
      'values="1;2;3;4;5" keyTimes="0;0.25;0.5;0.75;1" calcMode="discrete" dur="0.4s" repeatCount="indefinite"/>',
    );
  });

  test("displace animates feDisplacementMap's scale attribute, starting from the attribute's value", () => {
    const warp = def.filter(
      {},
      <feDisplacementMap
        in="SourceGraphic"
        scale={3}
        animation={motion().at(1).to({ displace: 9 }, 1, ease.linear)}
      />,
    );

    const svg = scene(<rect width={10} height={10} filter={warp} />);
    expect(svg).toContain('<animate attributeName="scale" values="3;3;9;9" keyTimes="0;0.1;0.2;1"');
  });
});
