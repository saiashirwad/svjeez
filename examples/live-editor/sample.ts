import type { Files } from "@svjeez/live";

/** The module a scene imports its font from. The page provides it, since a browser cannot load a font by name. */
export const FONT_MODULE = "example-fonts";

const NOTE_CARD = `import { Group, Shape, Text, component, enter, rect, span } from "svjeez";
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
      motion={[
        enter(span(1.2, 0.7), {
          from: reveal === "wipe" ? { opacity: 0, offset: [-40, 0] } : { opacity: 0 },
        }),
      ]}
    >
      <Shape
        id="frame"
        geometry={rect(width, 110, { radius: 14 })}
        fill="#1e293b"
        stroke={{ color: accent, width: 2 }}
      />
      <Text id="note" font={sans} size={14} fill="#e2e8f0" at={[18, 55]} anchor="baseline-left">
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
  scene({ size: [420, 520], duration: 4, title: "Invitation" }, () => (
    <Group id="invitation">
      <Shape id="paper" geometry={rect(420, 520)} fill="#0f172a" />
      <Text
        id="title"
        font={sans}
        size={26}
        fill="#f8fafc"
        at={[40, 120]}
        anchor="baseline-left"
        motion={[enter(span(0.2, 0.6))]}
      >
        You are invited
      </Text>
      <Text
        font={sans}
        size={16}
        fill="#94a3b8"
        at={[40, 156]}
        anchor="baseline-left"
        motion={[enter(span(0.5, 0.6))]}
      >
        {"Dear " + guest + ", join us."}
      </Text>
      <Shape
        id="seal"
        geometry={circle(26)}
        at={[66, 300]}
        fill="#f59e0b"
        scale={track(0.2).to(1, span(0.8, 0.5), ease.pop)}
      />
      <Arrow
        id="pointer"
        from={ref("seal").right}
        to={ref("note").left}
        stroke={{ color: "#f59e0b", width: 2 }}
        draw={track(0).to(1, span(1.1, 0.6), ease.out)}
      />
      <Group id="slot" at={[130, 245]}>
        <NoteCard id="note" width={240} reveal="fade" accent="#7c3aed" note="Bring a friend." />
      </Group>
    </Group>
  ));
`;

export const INITIAL_FILES: Files = {
  "design.tsx": DESIGN,
  "components/NoteCard.tsx": NOTE_CARD,
};

/** The scene renders from this file. */
export const ENTRY = "design.tsx";
