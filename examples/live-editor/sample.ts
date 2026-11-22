import type { Files } from "@svjeez/live";

/** The module a scene imports its font from. The page provides it, since a browser cannot load a font by name. */
export const FONT_MODULE = "example-fonts";

const NOTE_CARD = `import { Group, Shape, Text, component, ease, enter, moved, rect, span, track } from "svjeez";
import { sans } from "${FONT_MODULE}";

// A props schema is any Standard Schema; this one also writes itself as JSON Schema,
// and its "x-ui" hints tell an editor which control to draw for each prop.
const isReveal = (value) => value === "fade" || value === "wipe";

export const NoteCard = component({
  name: "NoteCard",
  props: {
    "~standard": {
      version: 1,
      vendor: "example",
      validate: (value) => {
        const { width = 240, reveal = "fade", accent = "#7c3aed", note = "Bring a friend." } = value;

        return typeof width === "number" && isReveal(reveal)
          ? { value: { width, reveal, accent, note } }
          : { issues: [{ message: "width is a number; reveal is fade or wipe" }] };
      },
      jsonSchema: {
        input: () => ({
          type: "object",
          properties: {
            width: {
              type: "number",
              minimum: 180,
              maximum: 320,
              "x-ui": { control: "slider", step: 4 },
            },
            reveal: {
              type: "string",
              enum: ["fade", "wipe"],
              "x-ui": { control: "segmented" },
            },
            accent: { type: "string", format: "color" },
            note: { type: "string", title: "Note" },
          },
        }),
        output: () => ({}),
      },
    },
  },
  render: ({ width, reveal, accent, note }) => (
    <Group
      motion={[reveal === "fade" && enter(span(1.7, 0.7), { from: { opacity: 0, scale: 0.96 } })]}
      clip={
        reveal === "wipe"
          ? track(moved(rect(0, 116), [-3, -3])).to(
              moved(rect(width + 6, 116), [-3, -3]),
              span(1.7, 0.7),
              ease.inOut,
            )
          : undefined
      }
    >
      <Shape
        id="frame"
        geometry={rect(width, 110, { radius: 14 })}
        fill="#1e293b"
        stroke={{ color: accent, width: 2 }}
      />
      <Shape geometry={rect(4, 46, { radius: 2 })} at={[20, 55]} anchor="left" fill={accent} />
      <Text id="note" font={sans} size={15} fill="#e2e8f0" at={[38, 55]} anchor="left">
        {note}
      </Text>
    </Group>
  ),
});
`;

const DESIGN = `import {
  Arrow,
  Group,
  Shape,
  Text,
  circle,
  ease,
  enter,
  param,
  radial,
  rect,
  ref,
  scene,
  span,
  track,
} from "svjeez";
import { sans } from "${FONT_MODULE}";
import { NoteCard } from "./components/NoteCard";

export const params = {
  guest: param.text("Ada", { label: "Guest", maxLength: 24 }),
};

export default ({ guest }) =>
  scene({ size: [420, 520], duration: 4, loop: false, title: "Invitation" }, () => (
    <Group id="invitation">
      <Shape id="paper" geometry={rect(420, 520)} fill="#0f172a" />
      <Shape
        geometry={rect(420, 520)}
        fill={radial.across({ center: "top", stops: ["#6366f126", "#6366f100"] })}
      />
      <Shape
        geometry={rect(388, 488, { radius: 12 })}
        at={[16, 16]}
        fill="#00000000"
        stroke={{ color: "#1e293b", width: 1 }}
      />
      <Text
        font={sans}
        size={12}
        fill="#f59e0b"
        at={[210, 76]}
        anchor="baseline"
        motion={[enter(span(0.1, 0.5), { from: { opacity: 0, offset: [0, 8] } })]}
      >
        AN INVITATION
      </Text>
      <Text
        id="title"
        font={sans}
        size={34}
        fill="#f8fafc"
        at={[210, 122]}
        anchor="baseline"
        motion={[enter(span(0.2, 0.6), { from: { opacity: 0, offset: [0, 12] } })]}
      >
        You are invited
      </Text>
      <Text
        font={sans}
        size={16}
        fill="#94a3b8"
        at={[210, 154]}
        anchor="baseline"
        motion={[enter(span(0.35, 0.6), { from: { opacity: 0, offset: [0, 12] } })]}
      >
        {"Dear " + guest + ", join us."}
      </Text>
      <Shape
        id="seal"
        geometry={circle(26)}
        at={[210, 228]}
        anchor="center"
        origin="center"
        fill="#f59e0b"
        stroke={{ color: "#fcd34d", width: 2 }}
        scale={track(0).to(1, span(0.8, 0.6), ease.pop)}
      />
      <Arrow
        id="pointer"
        from={ref("seal").bottom}
        to={ref("note").top}
        inset={8}
        stroke={{ color: "#f59e0b", width: 2 }}
        draw={track(0).to(1, span(1.4, 0.45), ease.out)}
      />
      <Group id="slot" at={[210, 312]} anchor="top">
        <NoteCard id="note" width={240} reveal="fade" accent="#7c3aed" note="Bring a friend." />
      </Group>
      <Text
        font={sans}
        size={12}
        fill="#64748b"
        at={[210, 472]}
        anchor="baseline"
        motion={[enter(span(2.3, 0.6))]}
      >
        Saturday at seven · RSVP by Friday
      </Text>
    </Group>
  ));
`;

export const INITIAL_FILES: Files = {
  "design.tsx": DESIGN,
  "components/NoteCard.tsx": NOTE_CARD,
};

/** The scene renders from this file. */
export const ENTRY = "design.tsx";
