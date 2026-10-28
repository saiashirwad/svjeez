import { clean, fail, unquote, type Line } from "./errors.ts";
import type { Participant, SequenceDoc, SequenceMessage, SequenceNote } from "./types.ts";

const SUPPORTED =
  "Supported: `participant A`, `actor A`, `participant A as Alice`, messages `A->>B: text` with the arrows ->> -->> -> --> -x --x -) --), and `Note over A: text`.";

const UNSUPPORTED = new Map(
  (
    [
      ["activate deactivate", "activations are not drawn by svjeez"],
      [
        "loop alt opt par critical break rect else and end",
        "loop, alt, opt, par and other blocks are not drawn by svjeez",
      ],
      ["autonumber", "svjeez does not number messages; put the number in the text"],
      ["title", "svjeez takes the title from render()"],
      ["box", "participant boxes are not drawn by svjeez"],
      ["create destroy", "created and destroyed participants are not drawn by svjeez"],
      ["link links", "links are not supported"],
    ] as const
  ).flatMap(([words, why]) => words.split(" ").map((w) => [w, why] as const)),
);

const DECLARE = /^(participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/;
const NOTE = /^note\s+(over|left of|right of)\s+([^:]+?)\s*:\s*(.*)$/i;
const MESSAGE = /^(\w+)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-])?\s*(\w+)\s*:\s*(.*)$/;

const HEADS = new Map<string, SequenceMessage["head"]>([
  [">>", "filled"],
  [">", "none"],
  ["x", "cross"],
  [")", "async"],
]);

export const parseSequence = (header: Line, body: readonly Line[]): SequenceDoc => {
  const participants = new Map<string, { label: string; role: Participant["role"] }>();
  const items: (SequenceMessage | SequenceNote)[] = [];

  const mention = (id: string) => {
    if (!participants.has(id)) participants.set(id, { label: id, role: "participant" });
  };

  for (const l of body) {
    const declared = DECLARE.exec(l.text);

    if (declared) {
      const [, role, id, alias] = declared;
      participants.set(id!, {
        label: alias === undefined ? id! : clean(unquote(alias)),
        role: role === "actor" ? "actor" : "participant",
      });
      continue;
    }

    const note = NOTE.exec(l.text);

    if (note) {
      const [, where, who, text] = note;

      if (where !== "over")
        fail(l, "svjeez draws a note on one actor's lifeline. Write `Note over A: text`.");

      if (!/^\w+$/.test(who!))
        fail(
          l,
          "a note spans several actors in Mermaid, and svjeez draws it on one. Name a single actor.",
        );

      if (!text) fail(l, "a note needs text after the colon.");
      mention(who!);
      items.push({ kind: "note", actor: who!, text: clean(text!) });
      continue;
    }

    const message = MESSAGE.exec(l.text);

    if (message) {
      const [, from, arrow, activation, to, text] = message;

      if (activation)
        fail(
          l,
          "the activation marks + and - are not supported: svjeez draws no activation bars. Remove them.",
        );

      if (!clean(text!)) fail(l, "a message needs text after the colon.");
      mention(from!);
      mention(to!);
      items.push({
        kind: "message",
        from: from!,
        to: to!,
        text: clean(text!),
        line: arrow!.startsWith("--") ? "dashed" : "solid",
        head: HEADS.get(arrow!.replace(/^--?/, ""))!,
      });
      continue;
    }

    const word = /^\w+/.exec(l.text)?.[0] ?? "";
    const why = UNSUPPORTED.get(word);

    fail(l, `${why ? `${word}: ${why}. ` : ""}Cannot read this line. ${SUPPORTED}`);
  }

  if (participants.size === 0)
    fail(header, "the sequence diagram has no participants or messages.");

  return {
    kind: "sequence",
    participants: [...participants].map(([id, p]): Participant => ({ id, ...p })),
    items,
  };
};
