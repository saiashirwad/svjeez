import { clean, fail, sourceOf, unquote, type Line } from "./errors.ts";
import type {
  MermaidParticipant,
  MermaidSequenceBlock,
  MermaidSequenceMessage,
  SequenceBox,
  SequenceDoc,
  SequenceItem,
  SequenceSection,
} from "./types.ts";

const SUPPORTED =
  "Supported: `participant A`, `actor A`, `participant A as Alice`, `box ... end`, `title`, messages `A->>B: text` with the arrows ->> -->> -> --> -x --x -) --) and `+`/`-` activation marks, `activate A`, `deactivate A`, `autonumber`, `Note over A,B: text`, `Note left of A: text`, and the blocks loop, alt/else, opt, par/and, critical/option, break and rect, each closed by `end`.";

const UNSUPPORTED = new Map(
  (
    [
      ["create destroy", "created and destroyed participants are not drawn by svjeez"],
      ["link links", "links are not supported"],
    ] as const
  ).flatMap(([words, why]) => words.split(" ").map((w) => [w, why] as const)),
);

const DECLARE = /^(participant|actor)\s+(\w+)(?:\s+as\s+(.+))?$/;
const NOTE = /^note\s+(over|left of|right of)\s+([^:]+?)\s*:\s*(.*)$/i;
const MESSAGE = /^(\w+)\s*(-->>|->>|-->|->|--x|-x|--\)|-\))\s*([+-])?\s*(\w+)\s*:\s*(.*)$/;
const BLOCK = /^(loop|alt|opt|par|critical|break)(?:\s+(.*))?$/;
const RECT = /^rect(?:\s+(.*))?$/;
const SECTION = /^(else|and|option)(?:\s+(.*))?$/;
const BOX = /^box(?:\s+(.*))?$/;
const AUTONUMBER = /^autonumber(?:\s+(.*))?$/;
const TITLE = /^title\s*:?\s*(.*)$/;
const COLOR = /^(rgba?\(\s*[^)]*\)|hsla?\(\s*[^)]*\)|#[0-9a-f]{3,8}\b|[a-z]+)(?:\s+(.*))?$/i;

const SECTIONS = new Map<string, MermaidSequenceBlock["block"]>([
  ["else", "alt"],
  ["and", "par"],
  ["option", "critical"],
]);

const HEADS = new Map<string, MermaidSequenceMessage["head"]>([
  [">>", "filled"],
  [">", "none"],
  ["x", "cross"],
  [")", "async"],
]);

const NAMED = new Map<string, `#${string}`>([
  ["aqua", "#00ffff"],
  ["black", "#000000"],
  ["blue", "#0000ff"],
  ["fuchsia", "#ff00ff"],
  ["gray", "#808080"],
  ["grey", "#808080"],
  ["green", "#008000"],
  ["lime", "#00ff00"],
  ["maroon", "#800000"],
  ["navy", "#000080"],
  ["olive", "#808000"],
  ["orange", "#ffa500"],
  ["pink", "#ffc0cb"],
  ["purple", "#800080"],
  ["red", "#ff0000"],
  ["silver", "#c0c0c0"],
  ["teal", "#008080"],
  ["white", "#ffffff"],
  ["yellow", "#ffff00"],
  ["lightblue", "#add8e6"],
  ["lightgreen", "#90ee90"],
  ["lightgrey", "#d3d3d3"],
  ["lightgray", "#d3d3d3"],
  ["lightyellow", "#ffffe0"],
]);

interface Paint {
  readonly color: `#${string}`;
  readonly opacity: number;
}

const hex2 = (n: number) =>
  Math.min(255, Math.max(0, Math.round(n)))
    .toString(16)
    .padStart(2, "0");

/** `#rgb`, `#rrggbb`, `rgb(r, g, b)`, `rgba(r, g, b, a)` or a basic color name. */
const paintOf = (word: string): Paint | undefined => {
  const text = word.trim().toLowerCase();

  if (NAMED.has(text)) return { color: NAMED.get(text)!, opacity: 1 };

  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(text);

  if (short)
    return {
      color: `#${short[1]!.repeat(2)}${short[2]!.repeat(2)}${short[3]!.repeat(2)}`,
      opacity: 1,
    };

  if (/^#[0-9a-f]{6}$/.test(text))
    // SAFETY: the pattern admits only `#` and six hex digits.
    return { color: text as `#${string}`, opacity: 1 };

  const rgb = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);

  if (!rgb) return undefined;

  return {
    color: `#${hex2(Number(rgb[1]))}${hex2(Number(rgb[2]))}${hex2(Number(rgb[3]))}`,
    opacity: rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4])),
  };
};

interface Scope {
  readonly block: MermaidSequenceBlock["block"];
  readonly line: Line;
  readonly label: string;
  readonly paint: Paint | undefined;
  readonly items: SequenceItem[];
  readonly sections: { label: string; items: SequenceItem[] }[];
}

export const parseSequence = (header: Line, body: readonly Line[]): SequenceDoc => {
  const participants = new Map<string, { label: string; role: MermaidParticipant["role"] }>();
  const root: SequenceItem[] = [];
  const scopes: Scope[] = [];
  const boxes: { label?: string; paint?: Paint; actors: string[]; line: Line }[] = [];
  const active = new Map<string, number>();
  let title: string | undefined;
  let boxing: (typeof boxes)[number] | undefined;

  const mention = (id: string) => {
    if (!participants.has(id)) participants.set(id, { label: id, role: "participant" });
  };

  const items = (): SequenceItem[] => {
    const scope = scopes.at(-1);

    return scope ? (scope.sections.at(-1)?.items ?? scope.items) : root;
  };

  const press = (l: Line, id: string, by: 1 | -1) => {
    const now = (active.get(id) ?? 0) + by;

    if (now < 0)
      fail(
        l,
        `${id} has no activation to end. Activate it first with \`activate ${id}\` or a \`+\` arrow.`,
      );
    active.set(id, now);
  };

  const sealed = (l: Line) => {
    if (boxing) fail(l, "a box holds only participant and actor lines. Close it with `end` first.");
  };

  for (const l of body) {
    const declared = DECLARE.exec(l.text);

    if (declared) {
      if (scopes.length > 0) fail(l, "declare participants before the first block.");
      const [, role, id, alias] = declared;

      participants.set(id!, {
        label: alias === undefined ? id! : clean(unquote(alias)),
        role: role === "actor" ? "actor" : "participant",
      });
      boxing?.actors.push(id!);
      continue;
    }

    if (/^end$/.test(l.text)) {
      const scope = scopes.pop();

      if (scope) {
        const [head, ...rest] = [{ label: scope.label, items: scope.items }, ...scope.sections];

        const block: MermaidSequenceBlock = {
          kind: "block",
          block: scope.block,
          label: head!.label,
          ...(scope.paint && { color: scope.paint.color, opacity: scope.paint.opacity }),
          items: head!.items,
          sections: rest.map((s): SequenceSection => s),
        };

        items().push(block);
      } else if (boxing) boxing = undefined;
      else fail(l, "`end` closes nothing. Open a block (loop, alt, ...) or a box first.");
      continue;
    }

    const box = BOX.exec(l.text);

    if (box) {
      if (scopes.length > 0 || boxing) fail(l, "a box cannot sit inside a block or another box.");
      const rest = clean(box[1] ?? "");
      const word = COLOR.exec(rest);
      const paint = word && paintOf(word[1]!);

      if (/^hsla?\(/i.test(rest))
        fail(l, "svjeez reads box colors as #rrggbb, rgb(), rgba() or a basic color name.");

      boxing = {
        line: l,
        actors: [],
        ...(paint
          ? { paint, label: clean(unquote(word[2] ?? "")) }
          : word && word[1]!.toLowerCase() === "transparent"
            ? { label: clean(unquote(word[2] ?? "")) }
            : { label: clean(unquote(rest)) }),
      };
      boxes.push(boxing);
      continue;
    }

    const heading = TITLE.exec(l.text);

    if (heading) {
      title = clean(heading[1]!);

      if (!title) fail(l, "a title needs text.");
      continue;
    }

    sealed(l);

    const rect = RECT.exec(l.text);

    if (rect) {
      const paint = paintOf(clean(rect[1] ?? ""));

      if (!paint)
        fail(
          l,
          "rect needs a color: `rect rgb(191, 223, 255)`, `rect rgba(0, 0, 255, .1)`, `rect #bfdfff` or a basic color name.",
        );
      scopes.push({ block: "rect", line: l, label: "", paint, items: [], sections: [] });
      continue;
    }

    const block = BLOCK.exec(l.text);

    if (block) {
      scopes.push({
        // SAFETY: BLOCK matches only these keywords.
        block: block[1] as MermaidSequenceBlock["block"],
        line: l,
        label: clean(block[2] ?? ""),
        paint: undefined,
        items: [],
        sections: [],
      });
      continue;
    }

    const section = SECTION.exec(l.text);

    if (section) {
      const scope = scopes.at(-1);
      const word = section[1]!;

      if (!scope || scope.block !== SECTIONS.get(word))
        fail(l, `\`${word}\` belongs inside a ${SECTIONS.get(word)} block.`);
      scope.sections.push({ label: clean(section[2] ?? ""), items: [] });
      continue;
    }

    const numbering = AUTONUMBER.exec(l.text);

    if (numbering) {
      const args = clean(numbering[1] ?? "");

      if (args === "off") items().push({ kind: "autonumber", start: false });
      else {
        const [start, step, ...more] = args === "" ? [] : args.split(" ");

        if (step !== undefined && (Number(step) !== 1 || more.length > 0))
          fail(l, "svjeez numbers messages one by one. Write `autonumber` or `autonumber 10`.");

        if (start !== undefined && !/^\d+$/.test(start))
          fail(l, "autonumber takes a start number or `off`.");
        items().push({ kind: "autonumber", start: start === undefined ? 1 : Number(start) });
      }

      continue;
    }

    const activation = /^(activate|deactivate)\s+(\w+)$/.exec(l.text);

    if (activation) {
      const [, word, id] = activation;
      mention(id!);
      press(l, id!, word === "activate" ? 1 : -1);
      // SAFETY: the pattern matches only these two words.
      items().push({ kind: word as "activate" | "deactivate", actor: id! });
      continue;
    }

    const note = NOTE.exec(l.text);

    if (note) {
      const [, where, who, text] = note;
      // SAFETY: NOTE matches only over, left of and right of.
      const side = where!.toLowerCase().split(" ")[0] as "over" | "left" | "right";
      const named = who!.split(",").map((w) => w.trim());

      if (!named.every((w) => /^\w+$/.test(w)))
        fail(l, "name the actors of a note by id, like `Note over A,B: text`.");

      if (named.length > 2) fail(l, "a note spans at most two actors.");

      if (named.length === 2 && side !== "over")
        fail(l, "only `Note over A,B` spans two actors. Name one actor for left of or right of.");

      if (!text) fail(l, "a note needs text after the colon.");

      for (const id of named) mention(id);
      items().push({
        kind: "note",
        actor: named[0]!,
        ...(named[1] !== undefined && { to: named[1] }),
        side,
        text: clean(text!),
      });
      continue;
    }

    const message = MESSAGE.exec(l.text);

    if (message) {
      const [, from, arrow, mark, to, text] = message;

      if (!clean(text!)) fail(l, "a message needs text after the colon.");
      mention(from!);
      mention(to!);

      if (mark === "+") press(l, to!, 1);

      if (mark === "-") press(l, from!, -1);
      items().push({
        kind: "message",
        from: from!,
        to: to!,
        text: clean(text!),
        reply: arrow!.startsWith("--"),
        head: HEADS.get(arrow!.replace(/^--?/, ""))!,
        activate: mark === "+",
        deactivate: mark === "-",
      });
      continue;
    }

    const word = /^\w+/.exec(l.text)?.[0] ?? "";
    const why = UNSUPPORTED.get(word);

    fail(l, `${why ? `${word}: ${why}. ` : ""}Cannot read this line. ${SUPPORTED}`);
  }

  const open = scopes.at(-1);

  if (open) fail(open.line, "this block is never closed. Add `end` after its messages.");

  if (boxing) fail(boxing.line, "this box is never closed. Add `end` after its participants.");

  if (participants.size === 0)
    fail(header, "the sequence diagram has no participants or messages.");

  const order = [...participants.keys()];

  const drawn = boxes.map((b): SequenceBox => {
    const at = b.actors.map((id) => order.indexOf(id)).sort((p, q) => p - q);

    if (at.some((x, k) => k > 0 && x !== at[k - 1]! + 1))
      fail(
        b.line,
        "this box's participants are not next to each other. Declare them together, before any message.",
      );

    return {
      ...(b.label && { label: b.label }),
      ...(b.paint && { color: b.paint.color, opacity: b.paint.opacity }),
      actors: at.map((x) => order[x]!),
    };
  });

  return {
    kind: "sequence",
    source: sourceOf(header),
    ...(title && { title }),
    participants: [...participants].map(([id, p]): MermaidParticipant => ({ id, ...p })),
    boxes: drawn,
    items: root,
  };
};
