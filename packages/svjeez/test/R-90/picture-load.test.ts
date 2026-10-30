import { describe, expect, test } from "bun:test";
import { picture } from "svjeez";
import { fixtures } from "../helpers/picture-fixtures";

describe("picture", () => {
  test("load reads a file by its content, not its extension", async () => {
    const path = `${import.meta.dir}/.picture-fixture.txt`;
    await Bun.write(path, fixtures.gif);

    try {
      expect(await picture.load(path)).toMatchObject({ format: "gif", width: 40, height: 30 });
      expect(await picture.load(new URL(`file://${path}`))).toMatchObject({ format: "gif" });
    } finally {
      await Bun.file(path).delete();
    }
  });

  test("load rejects a non-OK response with its status", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("nope", { status: 404 }) });

    try {
      await expect(picture.load(`http://localhost:${server.port}/x.png`)).rejects.toThrow("404");
    } finally {
      await server.stop(true);
    }
  });
});
