import { clean, fail, isDirection, sourceOf, unquote, type Line } from "./errors.ts";
import type {
  MermaidStateTransition,
  StateDoc,
  StateNode,
  StateNote,
  StateRegion,
  StateShape,
} from "./types.ts";

const SUPPORTED =
  'Supported: `[*] --> A`, `A --> [*]`, `A --> B : label`, `A : description`, `state "Long name" as A`, `state c <<choice>>` (or `<<fork>>`, `<<join>>`), `note right of A : text` (or a `note left of A` ... `end note` block), composite `state A {` ... `}` with `--` between concurrent regions, and `direction TB`, `LR`, `BT` or `RL` (TB or LR inside a composite).';

const TRANSITION = /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.*))?$/;
const SHAPED = /^state\s+(\w+)\s*<<\s*(choice|fork|join)\s*>>$/;
const NOTE = /^note\s+(left|right)\s+of\s+(\w+)\s*(?::\s*(.*))?$/i;
const DESCRIBE = /^(\w+)\s*:\s*(.+)$/;
const STYLE = /^(classDef|class|style)\s/;
const DECLARE = /^state\s+(?:"([^"]*)"\s+as\s+(\w+)|(\w+))\s*(\{)?$/;

interface Mutable {
  readonly id: string;
  label: string;
  final: boolean;
  shape?: StateShape;
  readonly detail: string[];
  direction?: "TB" | "LR";
  regions?: Scope[];
}

interface Scope {
  readonly states: Mutable[];
  initial?: string;
  readonly line: Line;
  readonly owner?: Mutable;
}

const region = (s: Scope): StateRegion => ({
  initial: s.initial!,
  states: s.states.map(freeze),
});

const freeze = (s: Mutable): StateNode => {
  const [first, ...rest] = s.regions ?? [];

  return {
    id: s.id,
    label: s.label,
    final: s.final,
    ...(s.shape && { shape: s.shape }),
    ...(s.detail.length > 0 && { detail: s.detail }),
    ...(first && {
      inner: {
        ...region(first),
        ...(s.direction && { direction: s.direction }),
        ...(rest.length > 0 && { parallel: rest.map(region) }),
      },
    }),
  };
};

export const parseState = (header: Line, body: readonly Line[]): StateDoc => {
  const root: Scope = { states: [], line: header };
  const stack = [root];
  const seen = new Map<string, Mutable>();
  const transitions: MermaidStateTransition[] = [];
  const notes: (StateNote & { readonly line: Line })[] = [];
  let direction: StateDoc["direction"];

  const state = (id: string): Mutable => {
    let s = seen.get(id);

    if (!s) {
      s = { id, label: id, final: false, detail: [] };
      seen.set(id, s);
      stack.at(-1)!.states.push(s);
    }

    return s;
  };

  const close = (scope: Scope) => {
    if (scope.initial !== undefined && !scope.states.some((s) => s.id === scope.initial))
      fail(
        scope.line,
        `the start state ${JSON.stringify(scope.initial)} belongs to another scope. Start at a state first mentioned inside this one.`,
      );

    if (scope.initial === undefined)
      fail(
        scope.line,
        scope === root
          ? "the diagram has no start. Add `[*] --> FirstState`."
          : "this composite state has no start. Add `[*] --> FirstState` inside it.",
      );
  };

  for (let i = 0; i < body.length; i++) {
    const l = body[i]!;

    if (l.text === "}") {
      if (stack.length === 1) fail(l, "`}` closes a composite state, and none is open.");
      close(stack.pop()!);
      continue;
    }

    if (l.text === "--") {
      const owner = stack.at(-1)!.owner;

      if (!owner)
        fail(l, "`--` separates concurrent regions, so it belongs inside a composite state.");
      close(stack.pop()!);

      const next: Scope = { states: [], line: l, owner };
      owner!.regions!.push(next);
      stack.push(next);
      continue;
    }

    if (STYLE.test(l.text)) continue;

    const note = NOTE.exec(l.text);

    if (note) {
      const lines = note[3] === undefined ? [] : [note[3]];

      if (note[3] === undefined) {
        while (i + 1 < body.length && !/^end\s+note$/i.test(body[i + 1]!.text))
          lines.push(body[++i]!.text);

        if (i + 1 >= body.length) fail(l, "this note is never closed. Add `end note`.");
        i++;
      }

      const text = lines.map(clean).filter(Boolean).join("\n");

      if (!text) fail(l, "this note has no text.");
      // SAFETY: NOTE only matches left or right, in any case
      const side = note[1]!.toLowerCase() as StateNote["side"];

      notes.push({
        of: note[2]!,
        side,
        text,
        line: l,
      });
      continue;
    }

    const text = l.text.replace(/(\w):::[\w-]+/g, "$1");
    const dir = /^direction\s+(\w+)$/.exec(text)?.[1];

    if (dir) {
      if (!isDirection(dir)) fail(l, `direction ${dir} is not one of TB, LR, BT or RL.`);

      const owner = stack.at(-1)!.owner;

      if (owner) {
        if (dir !== "TB" && dir !== "LR")
          fail(
            l,
            `direction ${dir} is drawn only for the whole diagram; inside a composite write TB or LR.`,
          );

        owner.direction = dir;
      } else {
        if (direction) fail(l, "direction is read once at the top of the diagram.");
        direction = dir;
      }

      continue;
    }

    const shaped = SHAPED.exec(text);

    if (shaped) {
      const s = state(shaped[1]!);
      // SAFETY: SHAPED only matches choice, fork or join
      s.shape = shaped[2] as StateShape;
      s.label = "";
      continue;
    }

    const declared = DECLARE.exec(text);

    if (declared) {
      const id = declared[2] ?? declared[3]!;
      const s = state(id);

      if (declared[1] !== undefined) s.label = clean(declared[1]) || id;

      if (declared[4]) {
        if (s.regions) fail(l, `state ${id} already has a body.`);
        const inner: Scope = { states: [], line: l, owner: s };
        s.regions = [inner];
        stack.push(inner);
      }

      continue;
    }

    const t = TRANSITION.exec(text);

    if (!t) {
      const described = DESCRIBE.exec(text);

      if (described) {
        state(described[1]!).detail.push(clean(described[2]!));
        continue;
      }

      return fail(l, `cannot read this line. ${SUPPORTED}`);
    }

    const [from, to] = [t[1]!, t[2]!];
    const label = clean(unquote(t[3] ?? "")) || undefined;
    const scope = stack.at(-1)!;

    if (from === "[*]" && to === "[*]") fail(l, "a transition from [*] to [*] has no state.");

    if (from === "[*]" || to === "[*]") {
      if (label)
        fail(
          l,
          "a transition to or from [*] cannot carry a label; svjeez draws it as a plain line.",
        );

      if (from === "[*]") {
        if (scope.initial !== undefined)
          fail(l, "this scope already has a start; `[*] -->` can appear once.");
        scope.initial = state(to).id;
      } else {
        state(from).final = true;
      }

      continue;
    }

    state(from);
    state(to);
    transitions.push({ from, to, ...(label && { label }) });
  }

  if (stack.length > 1) fail(stack.at(-1)!.line, "this composite state is never closed. Add `}`.");

  if (root.states.length === 0) fail(header, "the state diagram has no states.");
  close(root);

  for (const n of notes)
    if (!seen.has(n.of))
      fail(n.line, `this note is attached to ${n.of}, which is not a state. Name a state.`);

  return {
    kind: "state",
    source: sourceOf(header),
    ...(direction && { direction }),
    initial: root.initial!,
    states: root.states.map(freeze),
    transitions,
    ...(notes.length > 0 && { notes: notes.map(({ of, side, text }) => ({ of, side, text })) }),
  };
};
