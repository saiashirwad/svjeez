import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import {
  generateText,
  hasToolCall,
  isStepCount,
  jsonSchema as schemaOf,
  tool,
  type ModelMessage,
  type StopCondition,
  type ToolSet,
} from "ai";
import { jsonSchema, type Json, type JsonObject } from "svjeez/params";

import { complete } from "./ai";
import { LIMITS, type Deck } from "./document";
import { isKind, kinds, place } from "./slides";

const SYSTEM = [
  "You build an animated slide deck for the person by calling tools. Each slide is one kind of block.",
  "Call kinds to see the kinds, and schema for a kind's params before you first add one; write every param, and never reuse the schema's defaults, which only show the format.",
  "Add or change one slide per call. Each call builds the slide at once and answers ok or an error; when it is an error, fix that slide and call again.",
  "Use outline to see the deck. Prefer the kind that shows the idea best: a map for places, a chart for numbers, a diagram for steps or relations.",
  "When the deck does what was asked, call finish with one plain sentence for the person.",
].join(" ");

/** What a turn reports as it goes: a short line for the person, and the deck when it changed. */
export type Progress = (line: string, deck?: Deck) => void;

export interface TurnOptions {
  readonly key: string;
  readonly fetch?: DeepSeekProviderSettings["fetch"];
  /** Model calls this session has made before this turn. */
  readonly used: number;
  readonly progress: Progress;
}

export interface Turn {
  readonly deck: Deck;
  readonly messages: readonly ModelMessage[];
  readonly summary: string;
  readonly calls: number;
}

const message = (error: Error | string) => (error instanceof Error ? error.message : error);

const object = <T>(properties: JsonObject, required: readonly (keyof T & string)[]) =>
  schemaOf<T>({
    type: "object",
    properties,
    required: [...required],
    additionalProperties: false,
  });

const KIND = { type: "string", enum: Object.keys(kinds) };

const VALUES = {
  type: "object",
  description: "The kind's params, every one of them, as its schema describes.",
};

const ID = { type: "string", description: "A slide's id, as outline shows it." };

const POSITION = {
  type: "integer",
  minimum: 1,
  description: "1 for first. Leave out to add at the end.",
};

/**
 * One turn of the session agent: the model reads `history` and `request`, and edits `deck` only through tools that
 * check and build each slide at once. Every accepted change goes to `progress` with the new deck. The turn ends when
 * the model calls finish, or at a limit, with a plain sentence saying which.
 */
export const turn = async (
  deck: Deck,
  history: readonly ModelMessage[],
  request: string,
  { key, fetch, used, progress }: TurnOptions,
): Promise<Turn> => {
  let current = deck;
  let summary = "";

  const change = (next: Deck, line: string) => {
    current = next;
    progress(line, next);

    return { ok: true, slides: next.slides.length };
  };

  const find = (id: Json) => {
    const n = current.slides.findIndex((slide) => slide.id === id);

    if (n < 0)
      throw new Error(`There is no slide with id "${String(id)}". Call outline for the ids.`);

    return n;
  };

  const checked = (kind: string, values: Json, n: number) => {
    if (!isKind(kind))
      throw new Error(
        `"${String(kind)}" is not a kind. Use one of: ${Object.keys(kinds).join(", ")}.`,
      );

    place(kind, complete(kinds[kind].params, values), n);

    return kind;
  };

  const run = (what: string, act: () => object) => {
    try {
      return act();
    } catch (error) {
      const text = message(error instanceof Error ? error : String(error));

      const line = text.startsWith("Slide ") ? text : `${what}: ${text}`;

      progress(line.length > 140 ? `${line.slice(0, 137)}…` : line);

      return { error: text };
    }
  };

  const tools: ToolSet = {
    kinds: tool({
      description: "The kinds of slide there are, each with what it shows.",
      inputSchema: object<Record<never, never>>({}, []),
      execute: async () => Object.entries(kinds).map(([kind, { about }]) => ({ kind, about })),
    }),
    schema: tool({
      description:
        "The JSON Schema of one kind's params: what add_slide and replace_slide take as values.",
      inputSchema: object<{ kind: string }>({ kind: KIND }, ["kind"]),
      execute: async ({ kind }) =>
        run("schema", () => {
          if (!isKind(kind)) throw new Error(`"${kind}" is not a kind.`);

          const params = kinds[kind].params;

          return { ...jsonSchema(params), required: Object.keys(params) };
        }),
    }),
    outline: tool({
      description: "The deck's title and its slides in order, with ids, kinds and headings.",
      inputSchema: object<Record<never, never>>({}, []),
      execute: async () => ({
        title: current.title,
        slides: current.slides.map((slide, i) => ({
          n: i + 1,
          id: slide.id,
          kind: slide.kind,
          // SAFETY: every stored slide's values passed its kind's params, and every kind has a heading.
          heading: String((slide.values as JsonObject).heading ?? ""),
        })),
      }),
    }),
    add_slide: tool({
      description: "Adds a slide, built and checked at once. Answers ok, or an error to fix.",
      inputSchema: object<{ kind: string; values: Json; position?: number }>(
        { kind: KIND, values: VALUES, position: POSITION },
        ["kind", "values"],
      ),
      execute: async ({ kind, values, position }) =>
        run(`slide ${current.slides.length + 1} (${String(kind)})`, () => {
          if (current.slides.length >= LIMITS.slides)
            throw new Error(
              `The deck has the most slides it can, ${LIMITS.slides}. Remove one first.`,
            );

          const at =
            Math.min(Number(position ?? current.slides.length + 1), current.slides.length + 1) - 1;

          const slide = {
            id: crypto.randomUUID().slice(0, 8),
            kind: checked(kind, values, at + 1),
            values,
          };

          const slides = [...current.slides.slice(0, at), slide, ...current.slides.slice(at)];

          return {
            ...change({ ...current, slides }, `added slide ${at + 1}: ${slide.kind}`),
            id: slide.id,
          };
        }),
    }),
    replace_slide: tool({
      description:
        "Replaces a slide's values, keeping its kind and place. Answers ok, or an error to fix.",
      inputSchema: object<{ id: string; values: Json }>({ id: ID, values: VALUES }, [
        "id",
        "values",
      ]),
      execute: async ({ id, values }) =>
        run(`slide ${String(id)}`, () => {
          const n = find(id);
          const slide = { ...current.slides[n]!, values };

          checked(slide.kind, values, n + 1);

          const slides = current.slides.map((s, i) => (i === n ? slide : s));

          return change({ ...current, slides }, `changed slide ${n + 1}: ${slide.kind}`);
        }),
    }),
    remove_slide: tool({
      description: "Removes a slide.",
      inputSchema: object<{ id: string }>({ id: ID }, ["id"]),
      execute: async ({ id }) =>
        run("remove", () => {
          const n = find(id);

          return change(
            { ...current, slides: current.slides.filter((_, i) => i !== n) },
            `removed slide ${n + 1}`,
          );
        }),
    }),
    move_slide: tool({
      description: "Moves a slide to a new position.",
      inputSchema: object<{ id: string; position: number }>({ id: ID, position: POSITION }, [
        "id",
        "position",
      ]),
      execute: async ({ id, position }) =>
        run("move", () => {
          const n = find(id);
          const rest = current.slides.filter((_, i) => i !== n);
          const at = Math.max(0, Math.min(Number(position) - 1, rest.length));
          const slides = [...rest.slice(0, at), current.slides[n]!, ...rest.slice(at)];

          return change({ ...current, slides }, `moved slide ${n + 1} to ${at + 1}`);
        }),
    }),
    set_title: tool({
      description: "Sets the deck's title.",
      inputSchema: object<{ title: string }>({ title: { type: "string", maxLength: 80 } }, [
        "title",
      ]),
      execute: async ({ title }) =>
        change({ ...current, title: String(title) }, `titled the deck "${String(title)}"`),
    }),
    finish: tool({
      description: "Ends the turn with one plain sentence for the person about what changed.",
      inputSchema: object<{ summary: string }>({ summary: { type: "string", maxLength: 300 } }, [
        "summary",
      ]),
      execute: async ({ summary: line }) => {
        summary = String(line);

        return { ok: true };
      },
    }),
  };

  const spent: StopCondition<ToolSet> = ({ steps }) => used + steps.length >= LIMITS.calls;
  const messages: ModelMessage[] = [...history, { role: "user", content: request }];

  try {
    const result = await generateText({
      model: createDeepSeek({ apiKey: key, fetch })("deepseek-v4-flash"),
      system: SYSTEM,
      messages,
      tools,
      stopWhen: [isStepCount(LIMITS.steps), hasToolCall("finish"), spent],
      abortSignal: AbortSignal.timeout(LIMITS.ms),
      maxOutputTokens: 8000,
      providerOptions: { deepseek: { thinking: { type: "enabled" } } },
    });

    const calls = result.steps.length;

    const ending =
      summary ||
      (used + calls >= LIMITS.calls
        ? `This session has used its ${LIMITS.calls} model calls. Start a new session to keep going.`
        : result.steps.at(-1)?.toolCalls.length
          ? `I stopped after ${LIMITS.steps} steps without finishing. Send another message to continue.`
          : result.text || "Done.");

    return {
      deck: current,
      messages: [{ role: "user", content: request }, ...result.responseMessages],
      summary: ending,
      calls,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      deck: current,
      messages: [{ role: "user", content: request }],
      summary: timedOut
        ? `The turn ran past ${LIMITS.ms / 60_000} minutes and stopped. The slides added so far are kept.`
        : "The model could not be reached, or did not answer. The slides added so far are kept. Try again in a minute.",
      calls: 1,
    };
  }
};
