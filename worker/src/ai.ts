import { createDeepSeek, type DeepSeekProviderSettings } from "@ai-sdk/deepseek";
import {
  generateText,
  jsonSchema as schemaOf,
  NoObjectGeneratedError,
  Output,
  TypeValidationError,
  type ModelMessage,
} from "ai";
import { jsonSchema, type Json, type Schema } from "svjeez/params";

export interface FillOptions {
  /** A DeepSeek API key. */
  readonly key: string;
  readonly fetch?: DeepSeekProviderSettings["fetch"];
}

const reason = (error: NoObjectGeneratedError): string =>
  TypeValidationError.isInstance(error.cause) && error.cause.cause instanceof Error
    ? error.cause.cause.message
    : error.message;

/** `value` when it names every param, so the model writes the whole scene and never leans on a default. */
export const complete = (schema: Schema, value: Json): Json => {
  const given = Object.keys(value ?? {});
  const missing = Object.keys(schema).filter((key) => !given.includes(key));

  if (missing.length > 0)
    throw new Error(`Write every param yourself. These are missing: ${missing.join(", ")}.`);

  return value;
};

const SYSTEM = [
  "You fill in every param of an animated SVG template from the user's description.",
  "The defaults in the schema only show the format. Write content for this request and never reuse theirs.",
  "When the template cannot draw exactly what is asked, draw the closest thing it can and name that honestly in the title.",
].join(" ");

/** How many answers the model gets: the first, and a retry after each that does not fit. */
export const TRIES = 3;

/** The model answered every try, and no answer fit; the message is the last answer's problem. */
export class Unfit extends Error {}

/**
 * Asks a DeepSeek model for values that match `schema`, given `prompt`, and returns what `accept` makes of them. The
 * model only writes JSON. When `accept` throws, the model sees its message and answers again, up to `TRIES` answers
 * in all; then `Unfit` throws with the last message. A failure to reach the model throws as the SDK reports it.
 */
export const fill = async <T>(
  schema: Schema,
  prompt: string,
  accept: (json: Json) => T,
  { key, fetch }: FillOptions,
): Promise<T> => {
  const accepted = schemaOf<T>(
    { ...jsonSchema(schema), required: Object.keys(schema) },
    {
      validate: (value) => {
        try {
          // SAFETY: value is what JSON.parse read from the model's answer.
          return { success: true, value: accept(complete(schema, value as Json)) };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
          };
        }
      },
    },
  );

  const model = createDeepSeek({ apiKey: key, fetch })("deepseek-v4-flash");
  const messages: ModelMessage[] = [{ role: "user", content: prompt }];
  let problem = "";

  for (let attempt = 1; attempt <= TRIES; attempt++) {
    try {
      const { output } = await generateText({
        model,
        system: SYSTEM,
        messages,
        output: Output.object({ schema: accepted }),
        temperature: 0.2,
        maxOutputTokens: 4000,
        abortSignal: AbortSignal.timeout(60_000),
        // The first answer is quick. An answer that did not fit is worth thinking about.
        providerOptions: {
          deepseek: { thinking: { type: attempt === 1 ? "disabled" : "enabled" } },
        },
      });

      return output;
    } catch (error) {
      if (!NoObjectGeneratedError.isInstance(error)) throw error;
      problem = reason(error);
      messages.push(
        { role: "assistant", content: error.text ?? "" },
        { role: "user", content: `${problem} Answer again with one JSON object that fixes this.` },
      );
    }
  }

  throw new Unfit(problem);
};
