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

/**
 * Asks a DeepSeek model for values that match `schema`, given `prompt`, and returns what `accept` makes of them. The
 * model only writes JSON. When `accept` throws on the first answer, the model sees its message and answers once more;
 * a second failure throws with that message.
 */
export const fill = async <T>(
  schema: Schema,
  prompt: string,
  accept: (json: Json) => T,
  { key, fetch }: FillOptions,
): Promise<T> => {
  const accepted = schemaOf<T>(jsonSchema(schema), {
    validate: (value) => {
      try {
        // SAFETY: value is what JSON.parse read from the model's answer.
        return { success: true, value: accept(value as Json) };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error : new Error(String(error)) };
      }
    },
  });

  const ask = async (messages: ModelMessage[]) =>
    (
      await generateText({
        model: createDeepSeek({ apiKey: key, fetch })("deepseek-v4-flash"),
        system: "You fill in the params of an animated SVG scene from the user's description.",
        messages,
        output: Output.object({ schema: accepted }),
        temperature: 0.2,
        maxOutputTokens: 1500,
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
      })
    ).output;

  const first: ModelMessage = { role: "user", content: prompt };

  try {
    return await ask([first]);
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;

    const retry: ModelMessage = {
      role: "user",
      content: `${reason(error)} Answer again with one JSON object that fixes this.`,
    };

    return ask([first, { role: "assistant", content: error.text ?? "" }, retry]).catch((again) => {
      throw NoObjectGeneratedError.isInstance(again) ? new Error(reason(again)) : again;
    });
  }
};
