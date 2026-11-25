import { describe, expect, test } from "bun:test";
import { Text, font, scene, span, track, type SceneElement } from "svjeez";
import { check, svg, valueAt, type Model } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts";

const mono = await font.load(fontFixture("JetBrainsMono"));

// JetBrains Mono is 0.6em wide everywhere, so at size 10 every character is 6 across.
const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [300, 40], duration, title: "Swap" }, build);

const state = track("CLOSED")
  .set("SYN_SENT", span(1, 0))
  .to("ESTABLISHED", span(2, 0.5))
  .set("CLOSED", span(3.5, 0));

const label = (anchor?: "center" | "right") =>
  made(() => (
    <Text key="t" font={mono} size={10} fill="#000000" at={[100, 20]} {...(anchor && { anchor })}>
      {state}
    </Text>
  ));

const holder = (model: Model.Scene) => {
  const node = model.root.kind === "group" ? model.root.children[0] : undefined;

  if (node?.kind !== "group") throw new Error("expected a group");

  return node;
};

const shownAt = (model: Model.Scene, t: number): string[] =>
  holder(model)
    .children.filter((child) => child.kind === "text")
    .filter((child) => {
      const layer = child.layers[0];

      return !layer || valueAt(layer.opacity, t, (a: number) => a) === 1;
    })
    .map((child) => child.lines[0]!.runs[0]!.text);

describe("a string track as the content of a <Text>", () => {
  test("shows each value from its set, and a .to when its span is over", () => {
    const model = label();

    expect(shownAt(model, 0)).toEqual(["CLOSED"]);
    expect(shownAt(model, 0.99)).toEqual(["CLOSED"]);
    expect(shownAt(model, 1)).toEqual(["SYN_SENT"]);
    expect(shownAt(model, 2.4)).toEqual(["SYN_SENT"]);
    expect(shownAt(model, 2.5)).toEqual(["ESTABLISHED"]);
    expect(shownAt(model, 3.5)).toEqual(["CLOSED"]);
  });

  test("draws one text per distinct value", () => {
    const model = label();
    const out = svg.emit(model);

    expect(holder(model).children).toHaveLength(3);
    expect(holder(model).authored?.count?.ticks.map((tick) => tick.text)).toEqual([
      "CLOSED",
      "SYN_SENT",
      "ESTABLISHED",
      "CLOSED",
    ]);
    expect(out.match(/>CLOSED</g)).toHaveLength(1);
    expect(out).toContain(">SYN_SENT<");
    expect(out).toContain(">ESTABLISHED<");
  });

  test("applies the anchor to each value, so a centred label stays centred", () => {
    const centred = holder(label("center"));
    const [closed, syn, established] = centred.children;

    // Each text's own center sits on the same point: its width is 6 a character.
    expect(closed!.at).toEqual([-18, -6.6]);
    expect(syn!.at).toEqual([-24, -6.6]);
    expect(established!.at).toEqual([-33, -6.6]);
    expect(centred.at).toEqual([100, 20]);

    const right = holder(label("right")).children.map((child) => child.at);

    expect(right).toEqual([
      [-36, -6.6],
      [-48, -6.6],
      [-66, -6.6],
    ]);
  });

  test("passes check, and a value that is the same at the loop seam is no jump", () => {
    const model = label("center");

    expect(check(model).problems.filter((finding) => finding.severity !== "info")).toEqual([]);
  });

  test("warns when the loop seam jumps to the first value", () => {
    const model = made(() => (
      <Text key="t" font={mono} size={10} fill="#000000">
        {track("A").set("B", span(1, 0))}
      </Text>
    ));

    expect(check(model).problems.map((finding) => finding.code)).toContain("loop-seam");
  });

  test("a single-value track is a plain label, and empty values show nothing", () => {
    const model = made(() => (
      <Text key="t" font={mono} size={10} fill="#000000" at={[50, 20]} anchor="center">
        {track("").set("Hi", span(1, 0)).set("", span(2, 0))}
      </Text>
    ));

    expect(holder(model).children).toHaveLength(1);
    expect(shownAt(model, 0.5)).toEqual([]);
    expect(shownAt(model, 1.5)).toEqual(["Hi"]);
    expect(shownAt(model, 2.5)).toEqual([]);
  });

  test("refuses a value derived from a track", () => {
    const n = track(0).set(1, span(1, 0));

    // SAFETY: the type refuses a derived string, so the test forces one past it to see the error.
    const derived = n.map((value) => (value === 0 ? "off" : "on")) as never;

    expect(() =>
      made(() => (
        <Text key="t" font={mono} size={10} fill="#000000">
          {derived}
        </Text>
      )),
    ).toThrow("only a string track swaps");
  });

  test("refuses other words beside the track, and a track that shows nothing", () => {
    expect(() =>
      made(() => (
        <Text key="t" font={mono} size={10} fill="#000000">
          {["State: ", state]}
        </Text>
      )),
    ).toThrow("a swapping <Text> holds only that track");

    expect(() =>
      made(() => (
        <Text key="t" font={mono} size={10} fill="#000000">
          {track("")}
        </Text>
      )),
    ).toThrow("never shows any text");
  });
});
