import type { Mounted } from "./clocks";
import type { Place } from "./model/ir";

/** A place that runs its clock on repeat while the state lasts, instead of resting it. The same value as the scene's `looping`, so page code needn't load the authoring bundle. */
export const looping = "loop" as const;

export type { Place };

export interface MachineSpec<S extends string, E extends string> {
  /** The state it starts in: its clocks are shown at their resting places at once. */
  readonly initial: NoInfer<S>;
  /** Where each clock rests in each state, as progress from 0 to 1, or `looping` to run it on repeat. Clocks a state doesn't name stay where they are, and one that was looping pauses. */
  readonly states: { readonly [K in S]: Readonly<Record<string, Place>> };
  /** For each event, the state it leads to from each state; a state it doesn't name ignores it. A function decides from the current state. */
  readonly on: {
    readonly [K in E]: Partial<Record<NoInfer<S>, NoInfer<S>>> | ((state: S) => S | undefined);
  };
}

export interface Machine<S extends string, E extends string> {
  readonly state: S;
  /**
   * Move to the state `event` leads to from this one. Resolves true when every clock of the new state has arrived, and
   * false when something else moved first or the event is ignored in this state.
   */
  send(event: E): Promise<boolean>;
  /** Move to `state`, resolving as send() does. */
  go(state: S): Promise<boolean>;
  /** Call `listener` with the new state and the one it left when the state changes, at the start of the move. Returns the function that stops listening. */
  subscribe(listener: (state: S, from: S) => void): () => void;
  /** Halt any move, leaving the clocks where they are. */
  stop(): void;
}

/** What XState reports for a state: a name, or for nested and parallel states an object of regions. */
export type StateValue = string | { readonly [region: string]: StateValue | undefined };

export interface View {
  /** What it last went to; a value that matched no place doesn't count. */
  readonly state: StateValue | undefined;
  /**
   * Run every clock the state names from wherever it is to its resting place, or on repeat for a `looping` one.
   * Resolves true when all the resting clocks have arrived, and false when something else moved first, or the value
   * matches no place and nothing moves.
   */
  go(state: StateValue): Promise<boolean>;
  /** Jump to a state with no animation, for the first paint. */
  show(state: StateValue): void;
  /** Halt any move, leaving the clocks where they are. */
  stop(): void;
}

type Leads<S extends string> =
  | Readonly<Record<string, string | undefined>>
  | ((state: S) => S | undefined);

type Places = Readonly<Record<string, Place>>;

const listed = (names: Iterable<string>) =>
  [...names].map((name) => `"${name}"`).join(", ") || "none";

// A value's active paths: each region and state on the way down, as "menu", "menu.open", "menu.open.hovered".
const paths = (value: StateValue | undefined, parent = ""): string[] => {
  if (value === undefined) return [];

  if (!(value instanceof Object)) return [parent + value];

  return Object.entries(value).flatMap(([region, inside]) => [
    parent + region,
    ...paths(inside, `${parent}${region}.`),
  ]);
};

const depth = (path: string) => path.split(".").length;

/**
 * Where the clocks of a mounted scene rest in each state, and the way to move them there. `table` maps a state to
 * its clock rests, as progress from 0 to 1 or `looping`; going to a state runs those clocks from wherever they are, so
 * the scene's own easing plays, and going again mid-way retargets from there. A clock a state names as `looping` runs
 * on from where it is, wrapping from its end to 0, until a later state rests it, or leaves it unnamed, which pauses it.
 *
 * A state value is a name or, as XState reports nested and parallel states, an object of regions. It is flattened into
 * its active paths, `{ menu: { open: "hovered" } }` into "menu", "menu.open" and "menu.open.hovered", and the rests of
 * every key in `table` that is one of those paths apply, outermost first, so a deeper state overrides a clock a
 * shallower one set. Keys are names or dotted paths. A value that matches no key changes nothing and resolves false.
 * Any source of state drives it: `actor.subscribe((s) => view.go(s.value))`.
 *
 * `table` is optional: it defaults to the states the scene declared with `states` in scene(), which the SVG carries.
 */
export const rests = (
  scene: Mounted,
  table: Readonly<Record<string, Places>> = scene.states,
): View => {
  if (Object.keys(table).length === 0)
    throw new Error(
      "This SVG declares no states and rests() got no places. Give scene() a states option, or pass the places as the second argument.",
    );

  for (const [state, clocks] of Object.entries(table))
    for (const [name, amount] of Object.entries(clocks)) {
      if (!scene.clocks.has(name))
        throw new Error(
          `State "${state}" names the clock "${name}", but this SVG has ${listed(scene.clocks.keys())}. Name one of them.`,
        );

      if (amount !== looping && (!Number.isFinite(amount) || amount < 0 || amount > 1))
        throw new Error(
          `State "${state}" rests the clock "${name}" at ${amount}, but a place is progress from 0 to 1.`,
        );
    }

  let state: StateValue | undefined;
  let moves = 0;
  let moving: string[] = [];

  // The rest of each clock the value names, or undefined when it matches no key.
  const resting = (value: StateValue): Map<string, Place> | undefined => {
    const active = paths(value)
      .filter((path) => Object.hasOwn(table, path))
      .sort((a, b) => depth(a) - depth(b));

    if (active.length === 0) return undefined;

    return new Map(active.flatMap((path) => Object.entries(table[path]!)));
  };

  const stop = () => {
    moves++;

    for (const name of moving) scene.clock(name).pause();
    moving = [];
  };

  return {
    get state() {
      return state;
    },
    go: (value) => {
      const at = resting(value);

      if (at === undefined) return Promise.resolve(false);

      const mine = ++moves;

      // A clock the last move was still running and this one doesn't name stays where it is.
      for (const name of moving) if (!at.has(name)) scene.clock(name).pause();
      moving = [...at.keys()];
      state = value;

      return Promise.all(
        [...at].map(([name, place]) => {
          const clock = scene.clock(name);

          if (place !== looping) return clock.to(place * clock.over);

          clock.loop();

          return true;
        }),
      ).then((arrived) => mine === moves && arrived.every(Boolean));
    },
    show: (value) => {
      const at = resting(value);

      if (at === undefined) return;

      stop();
      state = value;

      moving = [];

      for (const [name, place] of at) {
        const clock = scene.clock(name);

        if (place === looping) {
          clock.loop();
          moving.push(name);
        } else clock.progress(place);
      }
    },
    stop,
  };
};

/**
 * A state machine over the clocks of a mounted scene: `rests()` for the visuals, and the events that lead from one
 * state to the next. The shorthand for simple widgets; an XState actor can drive `rests()` directly.
 */
export const machine = <S extends string, E extends string>(
  scene: Mounted,
  spec: MachineSpec<S, E>,
): Machine<S, E> => {
  const events: Readonly<Record<string, Leads<S>>> = spec.on;
  const view = rests(scene, spec.states);
  const names = Object.keys(spec.states);

  const known = (state: string | undefined): state is S =>
    state !== undefined && names.includes(state);

  if (!known(spec.initial))
    throw new Error(
      `The machine starts in "${spec.initial}", which is not a state; the states are ${listed(names)}. Set initial to one of them.`,
    );

  for (const [event, leads] of Object.entries(events))
    if (!(leads instanceof Function))
      for (const [from, next] of Object.entries(leads))
        if (!known(from) || !known(next))
          throw new Error(
            `Event "${event}" leads from "${from}" to "${next}", but the states are ${listed(names)}. Use only those.`,
          );

  const listeners = new Set<(state: S, from: S) => void>();
  let state = spec.initial;

  view.show(state);

  const go = (to: S): Promise<boolean> => {
    const from = state;

    state = to;

    if (from !== to) for (const listener of listeners) listener(to, from);

    return view.go(to);
  };

  return {
    get state() {
      return state;
    },
    send: (event) => {
      const leads: Leads<S> = events[event]!;
      const to = leads instanceof Function ? leads(state) : leads[state];

      if (to === undefined) return Promise.resolve(false);

      if (!known(to))
        throw new Error(
          `Event "${event}" leads from "${state}" to "${to}", but the states are ${listed(names)}. Return one of them.`,
        );

      return go(to);
    },
    go,
    subscribe: (listener) => {
      listeners.add(listener);

      return () => void listeners.delete(listener);
    },
    stop: view.stop,
  };
};
