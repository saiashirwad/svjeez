import type { WorkerLoader } from "@cloudflare/workers-types";
import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import {
  generateText,
  isStepCount,
  jsonSchema,
  tool,
  type JSONSchema7,
  type ModelMessage,
  type StopCondition,
  type ToolSet,
} from "ai";
import library from "virtual:library";

import { LIMITS } from "./limits";
import { FILES, SYSTEM } from "./prompt";
import { compile } from "./sandbox";

/** The longest summary the page shows above the change box. */
const SUMMARY = 300;

/** The model every turn runs on. */
export const MODEL = "deepseek-flash";

/** A line of the conversation the model sees again in a later turn. */
export interface Said {
  readonly role: "user" | "assistant";
  readonly text: string;
}

export interface TurnOptions {
  readonly key: string;
  readonly loader: WorkerLoader;
  /** Model calls this session made before this turn. */
  readonly used: number;
  /** A short line for the person, as each step happens. */
  readonly progress: (line: string) => void;
  readonly fetch?: DeepSeekProviderSettings["fetch"];
}

export interface Turn {
  /** The last source that compiled in this turn, with its SVG; none when nothing compiled. */
  readonly scene?: { readonly source: string; readonly svg: string };
  readonly summary: string;
  /** Model calls this turn made, and their tokens, counted as each one ends, so a turn cut short still counts. */
  readonly calls: number;
  readonly tokens: { readonly input: number; readonly output: number };
}

const object = <T>(properties: Record<string, JSONSchema7>) =>
  jsonSchema<T>({
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  });

const kb = (text: string) => `${Math.max(1, Math.round(text.length / 1024))} KB`;

/** The person's message, with the scene it changes when there is one. */
const request = (text: string, source: string | undefined) =>
  source === undefined
    ? text
    : `The current scene:\n\n\`\`\`tsx\n${source}\n\`\`\`\n\nChange it: ${text}`;

/**
 * One turn: the model reads the skill's files, writes the scene and compiles it until it answers ok, then finishes
 * with a sentence for the person. `source` is the session's current scene, which a follow-up edits; `said` is the
 * conversation so far. The turn ends when the model finishes, or at a limit, with a sentence saying which.
 */
export const turn = async (
  source: string | undefined,
  said: readonly Said[],
  text: string,
  { key, loader, used, progress, fetch }: TurnOptions,
): Promise<Turn> => {
  let scene: Turn["scene"];
  let compiles = 0;
  let failed = false;
  let summary = "";
  let calls = 0;
  const tokens = { input: 0, output: 0 };

  const tools: ToolSet = {
    read: tool({
      description: "Reads one of the svjeez skill's references or examples.",
      inputSchema: object<{ path: string }>({ path: { type: "string", enum: FILES } }),
      execute: async ({ path }) => {
        if (!FILES.includes(path)) return `There is no ${path}. Read one of: ${FILES.join(", ")}.`;

        progress(`reading ${path}`);

        return library.skill[path]!;
      },
    }),
    compile: tool({
      description:
        "Compiles the whole scene file. Answers ok with the SVG's size and warnings, or the first error with its line and the offending lines.",
      inputSchema: object<{ source: string }>({ source: { type: "string" } }),
      execute: async ({ source: next }) => {
        if (compiles >= LIMITS.compiles)
          return {
            ok: false,
            error: `You have used all ${LIMITS.compiles} compiles of this turn. Call finish and say what is left.`,
          };

        compiles++;

        const result = await compile(loader, next);

        if (!result.ok) {
          failed = true;
          progress(
            `compiled: ${result.error.kind} error${result.error.line ? ` on line ${result.error.line}` : ""}`,
          );

          return { ok: false, ...result.error };
        }

        failed = false;
        scene = { source: next, svg: result.svg };

        const warned = result.warnings.length;

        progress(
          `compiled: ok, ${kb(result.svg)}${warned ? `, ${warned} warning${warned > 1 ? "s" : ""}` : ""}`,
        );

        return { ok: true, bytes: result.svg.length, warnings: result.warnings };
      },
    }),
    finish: tool({
      description: "Ends the turn with one or two plain sentences for the person about the scene.",
      inputSchema: object<{ summary: string }>({ summary: { type: "string", maxLength: SUMMARY } }),
      execute: async ({ summary: line }) => {
        if (line.length > SUMMARY)
          return {
            ok: false,
            error: `The summary is ${line.length} characters. Say it in one or two sentences under ${SUMMARY}.`,
          };

        if (failed && compiles < LIMITS.compiles)
          return {
            ok: false,
            error:
              "The last compile failed. Fix the scene and compile it until it answers ok, then finish.",
          };

        summary = line;

        return { ok: true };
      },
    }),
  };

  const finished: StopCondition<ToolSet> = () => summary !== "";
  const spent: StopCondition<ToolSet> = ({ steps }) => used + steps.length >= LIMITS.calls;

  const kept = () =>
    scene ? "The scene shown is the last version that compiled." : "The scene is unchanged.";

  const messages: ModelMessage[] = [
    ...said.map((line): ModelMessage => ({ role: line.role, content: line.text })),
    { role: "user", content: request(text, source) },
  ];

  try {
    const result = await generateText({
      model: createDeepSeek({ apiKey: key, fetch })(MODEL),
      system: SYSTEM,
      messages,
      tools,
      stopWhen: [isStepCount(LIMITS.steps), finished, spent],
      abortSignal: AbortSignal.timeout(LIMITS.ms),
      // Thinking and a whole scene share this; a long scene needs more than 32K.
      maxOutputTokens: 64_000,
      providerOptions: { deepseek: { thinking: { type: "enabled" } } },
      onStepEnd: ({ usage }) => {
        calls++;
        tokens.input += usage.inputTokens ?? 0;
        tokens.output += usage.outputTokens ?? 0;
      },
    });

    const ending =
      summary ||
      (used + calls >= LIMITS.calls
        ? `This session has used its ${LIMITS.calls} model calls. Start a new one to keep going. ${kept()}`
        : compiles >= LIMITS.compiles && failed
          ? `I could not get the scene to compile in ${LIMITS.compiles} tries. ${kept()} Send a message to try again.`
          : calls >= LIMITS.steps
            ? `I stopped after ${LIMITS.steps} steps without finishing. ${kept()} Send a message to continue.`
            : result.finishReason === "length"
              ? `The model ran out of room before it finished writing. ${kept()} Ask again, perhaps for a little less.`
              : result.text || kept());

    return { scene, summary: ending, calls, tokens };
  } catch (error) {
    const timedOut =
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");

    return {
      scene,
      summary: timedOut
        ? `The turn ran past ${LIMITS.ms / 60_000} minutes and stopped. ${kept()}`
        : `The model could not be reached, or did not answer. ${kept()} Try again in a minute.`,
      calls,
      tokens,
    };
  }
};
