import type { Point } from "svjeez";
import type { Effect, Game, Input, World } from "./game.ts";
import { step } from "./run.ts";
import { createStage, type View } from "./stage.ts";

/** Draws what a frame's `hud` holds. It is called every frame, so it should touch the page only when the data changed. */
export type Paint<Hud> = (hud: Hud) => void;

export interface MountOptions<Msg, Hud> {
  /** How much of the world the camera shows, in world px. */
  readonly view: View;
  /**
   * Build the page around the world, once, and return what paints it. `send` is how a button there talks to the game:
   * it gives the game a message of its own.
   */
  readonly hud?: (host: HTMLElement, send: (msg: Msg) => void) => Paint<Hud>;
  /** Where `store` effects keep their strings. Default the browser's `localStorage`. */
  readonly storage?: Pick<Storage, "setItem">;
}

/** A game playing on a page. */
export interface Playing<Model, Msg> {
  /** The model as it is now. */
  model(): Model;
  send(msg: Msg): void;
  /** Stop the loop and take the world off the page. */
  stop(): void;
}

const AXES: readonly (readonly [code: string, x: number, y: number])[] = [
  ["KeyW", 0, -1],
  ["ArrowUp", 0, -1],
  ["KeyS", 0, 1],
  ["ArrowDown", 0, 1],
  ["KeyA", -1, 0],
  ["ArrowLeft", -1, 0],
  ["KeyD", 1, 0],
  ["ArrowRight", 1, 0],
];

const typing = (event: KeyboardEvent): boolean =>
  event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;

/**
 * Play a game in an element. Each frame the runtime sends the keys pressed since the last one, then a tick, and draws
 * what the view returns. Nothing else changes the model.
 */
export const mount = <Model, Msg, Hud, Action extends string, Where extends World>(
  game: Game<Model, Msg, Hud, Action, Where>,
  host: HTMLElement,
  { view, hud, storage }: MountOptions<Msg, Hud>,
): Playing<Model, Msg> => {
  const stage = createStage(host, game.world, view);
  const held = new Set<string>();
  const waiting: Input<Action>[] = [];
  const actions = new Map<string, Action>();
  const stop = new AbortController();
  let model = game.init(game.world);
  let last = performance.now();
  let first = true;
  let playing = true;

  // SAFETY: Object.keys of Keys<Action> gives exactly the Action names, which TypeScript widens to string.
  for (const action of Object.keys(game.keys) as Action[])
    for (const code of game.keys[action]) actions.set(code, action);

  const run = (effects: readonly Effect[]): void => {
    for (const effect of effects)
      if (effect.type === "flash") stage.flash(effect.sheet, effect.at, effect.seconds);
      else (storage ?? localStorage).setItem(effect.key, effect.value);
  };

  const send = (msg: Msg | Input<Action>): void => {
    const next = step(game, model, msg);

    model = next.model;
    run(next.effects);
  };

  const paint = hud?.(host, send);
  const listen = { signal: stop.signal };

  window.addEventListener(
    "keydown",
    (event) => {
      const action = actions.get(event.code);

      if (typing(event) || event.metaKey || event.ctrlKey) return;

      if (action !== undefined && !event.repeat) waiting.push({ type: "press", action });
      held.add(event.code);

      if (action !== undefined || AXES.some(([code]) => code === event.code))
        event.preventDefault();
    },
    listen,
  );

  window.addEventListener("keyup", (event) => held.delete(event.code), listen);
  window.addEventListener("blur", () => held.clear(), listen);

  host.addEventListener(
    "pointerdown",
    (event) => {
      if (event.target instanceof Node && stage.root.contains(event.target))
        waiting.push({ type: "point", at: stage.pointAt(event.clientX, event.clientY) });
    },
    listen,
  );

  const axis = (): Point => {
    let x = 0;
    let y = 0;

    for (const [code, dx, dy] of AXES)
      if (held.has(code)) {
        x += dx;
        y += dy;
      }

    const length = Math.max(1, Math.hypot(x, y));

    return { x: x / length, y: y / length };
  };

  const frame = (now: number): void => {
    if (!playing) return;
    const dt = Math.min(0.05, (now - last) / 1000);

    last = now;

    for (const input of waiting.splice(0)) send(input);
    send({ type: "tick", dt, axis: axis() });

    const drawn = game.view(model, game.world);

    stage.sprites(drawn.sprites);
    stage.patches(drawn.patches ?? []);
    stage.follow(drawn.camera, first ? undefined : dt);

    if (drawn.time !== undefined) stage.seek(drawn.time);
    paint?.(drawn.hud);
    first = false;
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);

  return {
    model: () => model,
    send,
    stop() {
      playing = false;
      stop.abort();
      stage.remove();
    },
  };
};
