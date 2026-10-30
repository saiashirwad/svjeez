import { describe, expect, test } from "bun:test";
import { LONDON, map, NEW_YORK, SAN_FRANCISCO, TOKYO } from "../helpers/geo-world.ts";

describe("line()", () => {
  test("runs through every waypoint in one piece when it stays on the map", () => {
    const [piece, ...rest] = map.line([NEW_YORK, LONDON, TOKYO]);

    expect(rest).toHaveLength(0);
    expect(piece![0]).toEqual(map.point(NEW_YORK));
    expect(piece!.at(-1)).toEqual(map.point(TOKYO));
    expect(piece!.some((p) => p.x === map.point(LONDON).x && p.y === map.point(LONDON).y)).toBe(
      true,
    );
  });

  test("cuts where it crosses the edge of the map", () => {
    const pieces = map.line([TOKYO, SAN_FRANCISCO]);

    expect(pieces).toHaveLength(2);
    expect(pieces[0]![0]).toEqual(map.point(TOKYO));
    expect(pieces[1]!.at(-1)).toEqual(map.point(SAN_FRANCISCO));
  });
});
