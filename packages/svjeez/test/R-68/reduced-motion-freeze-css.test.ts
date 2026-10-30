import { describe, expect, test } from "bun:test";
import { frozenMarker } from "../helpers/extras-frozen";

describe("reduced motion", () => {
  test("an animated Marker pauses every animation at the reducedMotion time", () => {
    expect(frozenMarker()).toContain(
      ".a{animation-delay:-4s!important;animation-play-state:paused!important}",
    );
  });
});
