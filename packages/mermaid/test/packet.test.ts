import { describe, expect, test } from "bun:test";
import { font, scene, span } from "svjeez";
import { SceneError, svg } from "svjeez/tools";
import type { Line } from "../src/errors.ts";
import { drawPacket, parsePacket, type PacketDoc } from "../src/packet.ts";
import { parseMermaid } from "../src/parse.ts";

const mono = await font.load(
  new URL("../../svjeez/tests/fixtures/JetBrainsMono.ttf", import.meta.url),
);

const parse = (text: string): PacketDoc => {
  const [header, ...body] = text
    .split("\n")
    .map((t, i): Line => ({ file: "p.mmd", line: i + 1, text: t.trim() }))
    .filter((l) => l.text !== "");

  return parsePacket(header!, body);
};

const message = (text: string): string => {
  try {
    parse(text);
  } catch (e) {
    if (e instanceof SceneError) return e.message;
    throw e;
  }

  throw new Error("parsePacket() did not throw");
};

describe("parse packet", () => {
  test("reads ranges, single bits, relative lengths and the title", () => {
    const doc = parse(`packet-beta
      title TCP
      0-15: "Source Port"
      16-31: 'Destination'
      +32: "Sequence"
      64: "A"
      +4: "Rest"`);

    expect(doc.kind).toBe("packet");
    expect(doc.title).toBe("TCP");
    expect(doc.fields.map((f) => [f.label, f.from, f.to])).toEqual([
      ["Source Port", 0, 15],
      ["Destination", 16, 31],
      ["Sequence", 32, 63],
      ["A", 64, 64],
      ["Rest", 65, 68],
    ]);
    expect(doc.fields[0]!.source).toEqual({ file: "p.mmd", line: 3 });
  });

  test("accepts the plain `packet` header through parseMermaid", () => {
    expect(parseMermaid('packet\n0-7: "A"').kind).toBe("packet");
  });

  test("errors name the line and say how to fix it", () => {
    expect(message('packet-beta\n0-15: "A"\n20-31: "B"')).toContain("start at 16");
    expect(message('packet-beta\n5-2: "A"')).toContain("Write 2-5");
    expect(message('packet-beta\n+0: "A"')).toContain("at least 1 bit");
    expect(message('packet-beta\n0-7: ""')).toContain("needs a label");
    expect(message("packet-beta\n0-7: A")).toContain("cannot read this line as a field");
    expect(message('packet-beta\naccTitle: x\n0-7: "A"')).toContain("accessibility");
    expect(message("packet-beta")).toContain("no fields");
    expect(message('packet-beta\n+99999999: "A"')).toContain("past the");
    expect(message("packet-beta x\n")).toContain("just `packet-beta`");
  });
});

describe("draw packet", () => {
  test("draws fields, splitting one across rows, and reveals in order", () => {
    const doc = parse('packet-beta\ntitle Hdr\n0-15: "Port"\n+40: "Long field"\n56: "URG"');
    const chart = drawPacket(doc, { font: mono, reveal: span(0.5, 0.25) });

    const out = svg.emit(
      scene({ size: [900, 400], duration: 4, title: "Packet", loop: false }, () => chart.node),
    );

    expect(chart.when("field-1")?.start).toBe(0.5);
    expect(chart.when("field-3")?.start).toBe(1);
    expect(out).toContain(">Long field<");
    expect(out).toContain(">Hdr<");
    expect(out).toContain(">56<");
  });
});
