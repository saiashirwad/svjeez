import { describe, expect, test } from "bun:test";
import { latestWins } from "../../src/client.ts";
import { wait } from "../helpers/live-timing";

describe("latestWins", () => {
  test("a job that throws still lets the queued one run", async () => {
    const ran: string[] = [];

    const queue = latestWins(async (job: string) => {
      ran.push(job);
      await wait(10);

      if (job === "a") throw new Error("boom");
    });

    queue("a");
    queue("b");
    await wait(50);

    expect(ran).toEqual(["a", "b"]);
  });
});
