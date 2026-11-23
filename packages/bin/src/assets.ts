import pack from "../.build/assets.pack" with { type: "file" };

/** What scripts/binary.ts packs into the binary beside the code: read only by the commands that need it. */
export interface Assets {
  readonly version: string;
  /** A hash of everything below, naming the cache folder they unpack to. */
  readonly hash: string;
  /** Each module's declaration file, as a path under types/. */
  readonly specifiers: Readonly<Record<string, string>>;
  /** The packages' declaration files, by path under types/. */
  readonly types: Readonly<Record<string, string>>;
  /** TypeScript's lib.*.d.ts files, by name. */
  readonly libs: Readonly<Record<string, string>>;
  /** @types/node and the undici-types it imports, by path under node_modules/, so scenes can use node: modules. */
  readonly node: Readonly<Record<string, string>>;
  /** The svjeez skill's text files, by path inside its folder. */
  readonly skill: Readonly<Record<string, string>>;
  /** Its other files (fonts), base64, by path inside its folder. */
  readonly skillBinary: Readonly<Record<string, string>>;
}

let loaded: Promise<Assets> | undefined;

export const assets = (): Promise<Assets> => (loaded ??= Bun.file(pack).json());
