import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { Group, Shape, polygon, scene, span, track, type SceneElement } from "svjeez";
import { svg } from "svjeez/tools";

const ring = (n: number, r: number, k = 0) =>
  polygon(
    ...Array.from({ length: n }, (_, i): [number, number] => {
      const a = (i / n) * Math.PI * 2;
      const rr = r * (1 + 0.15 * Math.sin(i * 3 + k));

      return [100 + Math.cos(a) * rr, 100 + Math.sin(a) * rr];
    }),
  );

const emit = (build: () => SceneElement) =>
  svg.emit(scene({ size: [200, 200], duration: 2, title: "Layers", loop: false }, build));

const layers = [
  "#C08040",
  { paint: "#FF0000", opacity: 0.5 },
  { paint: "#00FF00", blend: "multiply" },
] as const;

describe("layered paints share their geometry", () => {
  const big = ring(50, 70);

  test("a single paint writes its geometry in place", () => {
    const out = emit(() => <Shape geometry={big} fill="#C08040" />);

    expect(out).not.toContain("<use");
    expect(out).toContain("<polygon points=");
  });

  test("layers draw one shared outline", () => {
    const out = emit(() => <Shape key="blob" geometry={big} fill={[...layers]} />);
    const solo = emit(() => <Shape key="blob" geometry={big} fill="#C08040" />);

    expect(out.match(/points="/g)).toHaveLength(1);
    expect(out.match(/<use href="#g1"/g)).toHaveLength(3);
    expect(out).toContain("mix-blend-mode:multiply");
    expect(out.length).toBeLessThan(solo.length * 1.6);
  });

  test("layered strokes share it too", () => {
    const out = emit(() => (
      <Shape
        key="rim"
        geometry={big}
        stroke={{ color: ["#000000", { paint: "#FFFFFF", opacity: 0.4 }], width: 3 }}
      />
    ));

    expect(out.match(/points="/g)).toHaveLength(1);
    expect(out.match(/<use /g)).toHaveLength(2);
  });

  test("an animated outline animates the one shared path, and its still twin", () => {
    const out = emit(() => (
      <Shape
        key="moving"
        geometry={track(ring(50, 20)).to(ring(50, 30, 2), span(0, 2))}
        fill={[...layers]}
      />
    ));

    expect(out.match(/<animate attributeName="d"/g)).toHaveLength(1);
    expect(out).toMatch(/<path id="g1s?"/);
    expect(out).toContain('<path id="g1s"');
    expect(out.match(/<use href="#g1s"/g)).toHaveLength(3);
  });

  test("a short outline stays in place", () => {
    const out = emit(() => (
      <Group>
        <Shape key="tri" geometry={polygon([0, 0], [10, 0], [5, 8])} fill={[...layers]} />
      </Group>
    ));

    expect(out).not.toContain("<use");
  });

  test("renders the same as the layers drawn apart", async () => {
    const shot = async (build: () => SceneElement) =>
      Buffer.from(
        (await renderFrames(emit(build), { times: [1], background: "#ffffff" })).frames[0]!.png,
      );

    const shared = await shot(() => <Shape key="a" geometry={big} fill={[...layers]} />);

    const apart = await shot(() => (
      <Group>
        <Shape key="a1" geometry={ring(50, 70)} fill="#C08040" />
        <Shape key="a2" geometry={ring(50, 70)} fill="#FF0000" opacity={0.5} />
        <Shape key="a3" geometry={ring(50, 70)} fill="#00FF00" blend="multiply" />
      </Group>
    ));

    expect(shared.equals(apart)).toBe(true);
  });
});
