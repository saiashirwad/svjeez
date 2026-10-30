import { describe, expect, test } from "bun:test";
import { sampled } from "svjeez";

describe("sampled", () => {
  test("samples whose keys change partway are an error", () => {
    const options = { duration: 2, tolerance: { translate: 1, opacity: 0.1 } };
    expect(() => sampled((t) => (t < 1 ? { x: t, opacity: 1 } : { x: t }), options)).toThrow(
      /different channels at t=1/,
    );
    expect(() => sampled((t) => (t < 1 ? { x: t } : { x: t, opacity: 1 }), options)).toThrow(
      /different channels/,
    );
    expect(() => sampled((t) => ({ x: t, opacity: t < 1 ? 1 : undefined }), options)).toThrow(
      /different channels at t=1/,
    );
  });
});
