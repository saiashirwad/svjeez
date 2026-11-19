import { describe, expect, test } from "bun:test";
import { Group, Shape, circle, font, scene, span } from "svjeez";
import { SceneError, check, svg, type Child } from "svjeez/tools";
import type { DiagramColors } from "../src/kit.tsx";
import { packet } from "../src/packet.tsx";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const colors: DiagramColors = {
  background: "#FFFFFF",
  text: "#1D1D1F",
  line: "#6E6E73",
  accent: "#0A6CFF",
};

const options = { font: mono, colors };

const draw = (child: Child) =>
  scene({ size: [900, 400], duration: 6, title: "Packet", loop: false }, () => (
    <Group>
      <Shape geometry={circle(1)} at={[0, 0]} fill="#FFFFFF" />
      <Group offset={[20, 20]}>{child}</Group>
    </Group>
  ));

const thrown = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;
    throw error;
  }

  throw new Error("it did not throw");
};

const header = {
  src: { label: "Source", from: 0, to: 15 },
  dst: { label: "Destination", from: 16, to: 31 },
  seq: { label: "Sequence", from: 32, to: 79 },
};

describe("packet", () => {
  test("draws each field with its bit numbers and no scene errors", () => {
    const chart = packet({ title: "Header", fields: header }, options);
    const out = svg.emit(draw(chart.node));

    expect(check(draw(chart.node)).problems.filter((p) => p.severity === "error")).toEqual([]);
    expect(out).toContain(">Source<");
    expect(out).toContain(">Header<");
    expect(out).toContain(">15<");
    expect(chart.size[0]).toBeGreaterThan(chart.size[1]);
    expect(chart.span).toBeUndefined();
  });

  test("a field wider than a row continues on the next row", () => {
    const out = svg.emit(draw(packet({ fields: header }, options).node));

    expect(out.match(/>Sequence</g)).toHaveLength(2);
    expect(out).toContain(">63<");
    expect(out).toContain(">64<");
  });

  test("bitsPerRow sets the row width", () => {
    const [w16] = packet({ bitsPerRow: 16, fields: header }, options).size;
    const [w32] = packet({ fields: header }, options).size;

    expect(w16).toBeLessThan(w32);
  });

  test("fields reveal one beat each in order", () => {
    const chart = packet({ fields: header }, { ...options, reveal: span(1, 0.5) });

    expect(chart.when("src")?.start).toBe(1);
    expect(chart.when("seq")?.start).toBe(2);
    expect(chart.span?.start).toBe(1);
  });

  test("rejects overlapping, backwards and empty fields", () => {
    expect(
      thrown(() =>
        packet(
          { fields: { a: { label: "A", from: 0, to: 7 }, b: { label: "B", from: 4, to: 9 } } },
          options,
        ),
      ).problem,
    ).toContain("reaches bit 7");
    expect(
      thrown(() => packet({ fields: { a: { label: "A", from: 5, to: 2 } } }, options)).problem,
    ).toContain("bit 5 to bit 2");
    expect(thrown(() => packet({ fields: {} }, options)).problem).toContain("at least one field");
    expect(thrown(() => packet({ bitsPerRow: 0, fields: header }, options)).problem).toContain(
      "bitsPerRow",
    );
    // SAFETY: a value the types forbid, on purpose, to read the runtime error
    expect(thrown(() => packet({ fields: header }, options).part("x" as never)).problem).toBe(
      'packet() has no part "x".',
    );
  });
});
