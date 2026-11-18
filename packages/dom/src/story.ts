import { html, snap, wait, type Flow, type Instruction, type Timing } from "./flow.ts";

export interface Program<Model, Msg, Cmd> {
  readonly update: (model: Model, msg: Msg) => readonly [Model, readonly Cmd[]];
  readonly view: (model: Model) => string;
  readonly resolve?: (cmd: Cmd, model: Model) => readonly Msg[] | Promise<readonly Msg[]>;
}

export interface Pace extends Timing {
  readonly hold?: number;
}

export type Beat<Model, Msg, Cmd> =
  | { readonly given: Model; readonly cmds?: readonly Cmd[]; readonly pace?: Pace }
  | { readonly message: Msg; readonly pace?: Pace }
  | { readonly wait: number };

export const given = <Model, Cmd>(model: Model, cmds: readonly Cmd[] = []) => ({
  given: model,
  cmds,
});

export const message = <Msg>(msg: Msg) => ({ message: msg });

export const timed = <B extends { readonly message: unknown } | { readonly given: unknown }>(
  beat: B,
  pace: Pace,
): B & { readonly pace: Pace } => ({ ...beat, pace });

export const story = async <Model, Msg, Cmd>(
  { update, view, resolve = () => [] }: Program<Model, Msg, Cmd>,
  beats: readonly Beat<Model, Msg, Cmd>[],
  pace: Pace = {},
): Promise<{ html: string; flow: Flow; model: Model }> => {
  let model: { value: Model } | undefined;
  let shown: string | undefined;
  let first = "";
  const flow: Instruction[] = [];

  const step = async (from: Model, msg: Msg) => {
    const [next, cmds] = update(from, msg);

    return await settle(next, cmds);
  };

  const settle = async (from: Model, cmds: readonly Cmd[]): Promise<{ value: Model }> => {
    let next = from;

    for (const cmd of cmds)
      for (const msg of await resolve(cmd, next)) next = (await step(next, msg)).value;

    return { value: next };
  };

  for (const beat of beats) {
    if ("wait" in beat) {
      flow.push(wait(beat.wait));
      continue;
    }

    if ("given" in beat) model = await settle(beat.given, beat.cmds ?? []);
    else if (model) model = await step(model.value, beat.message);
    else throw new Error("story(): a message comes before any given(model).");

    const markup = view(model.value);

    if (markup === shown) continue;
    const { hold, ...timing } = { ...pace, ...beat.pace };

    if (shown === undefined) {
      first = markup;
      flow.push(snap());
    } else flow.push(html(markup), snap(timing));

    shown = markup;

    if (hold) flow.push(wait(hold));
  }

  if (!model) throw new Error("story(): needs a given(model) to start from.");

  return { html: first, flow, model: model.value };
};
