import { clean, fail, unquote, type Line } from "./errors.ts";
import type { StateDoc, StateNode, StateTransition } from "./types.ts";

const SUPPORTED =
  'Supported: `[*] --> A`, `A --> [*]`, `A --> B : label`, `state "Long name" as A`, composite `state A {` ... `}`, and `direction LR` at the top.';

const TRANSITION = /^(\[\*\]|\w+)\s*-->\s*(\[\*\]|\w+)\s*(?::\s*(.*))?$/;
const DECLARE = /^state\s+(?:"([^"]*)"\s+as\s+(\w+)|(\w+))\s*(\{)?$/;

interface Mutable {
  readonly id: string;
  label: string;
  final: boolean;
  inner?: Scope;
}

interface Scope {
  readonly states: Mutable[];
  initial?: string;
  readonly line: Line;
}

const freeze = (s: Mutable): StateNode => ({
  id: s.id,
  label: s.label,
  final: s.final,
  ...(s.inner && { inner: { initial: s.inner.initial!, states: s.inner.states.map(freeze) } }),
});

export const parseState = (header: Line, body: readonly Line[]): StateDoc => {
  const root: Scope = { states: [], line: header };
  const stack = [root];
  const seen = new Map<string, Mutable>();
  const transitions: StateTransition[] = [];
  let direction: StateDoc["direction"];

  const state = (id: string): Mutable => {
    let s = seen.get(id);

    if (!s) {
      s = { id, label: id, final: false };
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

  for (const l of body) {
    if (l.text === "}") {
      if (stack.length === 1) fail(l, "`}` closes a composite state, and none is open.");
      close(stack.pop()!);
      continue;
    }

    const dir = /^direction\s+(\w+)$/.exec(l.text)?.[1];

    if (dir) {
      if (stack.length > 1 || direction)
        fail(l, "direction is read once, at the top of the diagram, not inside a composite state.");

      if (dir !== "TB" && dir !== "LR")
        fail(l, `direction ${dir} is not drawn: svjeez lays out TB and LR.`);
      direction = dir;
      continue;
    }

    const declared = DECLARE.exec(l.text);

    if (declared) {
      const id = declared[2] ?? declared[3]!;
      const s = state(id);

      if (declared[1] !== undefined) s.label = clean(declared[1]) || id;

      if (declared[4]) {
        if (s.inner) fail(l, `state ${id} already has a body.`);
        s.inner = { states: [], line: l };
        stack.push(s.inner);
      }

      continue;
    }

    const t = TRANSITION.exec(l.text);

    if (!t)
      return fail(
        l,
        `cannot read this line. ${/<<|^note\b|^--$|:/.test(l.text) ? "Choices, forks, notes, concurrency and state descriptions are not supported. " : ""}${SUPPORTED}`,
      );

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

  return {
    kind: "state",
    ...(direction && { direction }),
    initial: root.initial!,
    states: root.states.map(freeze),
    transitions,
  };
};
