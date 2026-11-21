import type { Mounted } from "./clocks";

export interface MachineSpec<S extends string, E extends string> {
  /** The state it starts in: its clocks are shown at their resting places at once. */
  readonly initial: NoInfer<S>;
  /** Where each clock rests in each state, as progress from 0 to 1. Clocks a state doesn't name stay where they are. */
  readonly states: { readonly [K in S]: Readonly<Record<string, number>> };
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

type Leads<S extends string> =
  | Readonly<Record<string, string | undefined>>
  | ((state: S) => S | undefined);

const listed = (names: Iterable<string>) =>
  [...names].map((name) => `"${name}"`).join(", ") || "none";

/**
 * A state machine over the clocks of a mounted scene. A state says where each clock rests; moving to it runs those
 * clocks from wherever they are, so the scene's own easing plays, and moving again mid-way retargets from there.
 */
export const machine = <S extends string, E extends string>(
  scene: Mounted,
  spec: MachineSpec<S, E>,
): Machine<S, E> => {
  const states: Readonly<Record<string, Readonly<Record<string, number>>>> = spec.states;
  const events: Readonly<Record<string, Leads<S>>> = spec.on;

  const rests = new Map(
    Object.entries(states).map(([state, places]) => [state, Object.entries(places)]),
  );

  const names = [...rests.keys()];

  const known = (state: string | undefined): state is S =>
    state !== undefined && names.includes(state);

  if (!known(spec.initial))
    throw new Error(
      `The machine starts in "${spec.initial}", which is not a state; the states are ${listed(names)}. Set initial to one of them.`,
    );

  for (const [state, places] of rests)
    for (const [name, amount] of places) {
      if (!scene.clocks.has(name))
        throw new Error(
          `State "${state}" names the clock "${name}", but this SVG has ${listed(scene.clocks.keys())}. Name one of them.`,
        );

      if (!Number.isFinite(amount) || amount < 0 || amount > 1)
        throw new Error(
          `State "${state}" rests the clock "${name}" at ${amount}, but a place is progress from 0 to 1.`,
        );
    }

  for (const [event, leads] of Object.entries(events))
    if (!(leads instanceof Function))
      for (const [from, next] of Object.entries(leads))
        if (!known(from) || !known(next))
          throw new Error(
            `Event "${event}" leads from "${from}" to "${next}", but the states are ${listed(names)}. Use only those.`,
          );

  const listeners = new Set<(state: S, from: S) => void>();
  let state = spec.initial;
  let moves = 0;
  let moving: string[] = [];

  const rest = (name: string, amount: number) => {
    const clock = scene.clock(name);

    return clock.to(amount * clock.over);
  };

  for (const [name, amount] of rests.get(state)!) scene.clock(name).progress(amount);

  const stop = () => {
    moves++;

    for (const name of moving) scene.clock(name).pause();
    moving = [];
  };

  const go = (to: S): Promise<boolean> => {
    const from = state;
    const places = rests.get(to)!;
    const mine = ++moves;

    // A clock the last move was still running and this one doesn't name stays where it is.
    for (const name of moving)
      if (!places.some(([named]) => named === name)) scene.clock(name).pause();
    moving = places.map(([name]) => name);
    state = to;

    if (from !== to) for (const listener of listeners) listener(to, from);

    return Promise.all(places.map(([name, amount]) => rest(name, amount))).then(
      (arrived) => mine === moves && arrived.every(Boolean),
    );
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
    stop,
  };
};
