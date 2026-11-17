import type { WorkerLoaderModule } from "@cloudflare/workers-types";
import library from "virtual:library";

/** The name the scene's module has in the sandbox, as its errors' stacks show it. */
export const SCENE = "scene.tsx";

const FONTS = "@svjeez/fonts";

const isChunk = (name: string) => name.startsWith("chunk-");

/** Every specifier a scene may import, in the order the prompt lists them. */
export const ALLOWED: readonly string[] = [
  ...Object.keys(library.code).filter((name) => !isChunk(name)),
  FONTS,
  ...Object.keys(library.json),
];

const FACES = Object.keys(library.fonts);

/** "Inter 400, 500 and 600; Geist 400" from "Inter 400", "Inter 500", … */
const facesText = () => {
  const families = new Map<string, string[]>();

  for (const face of FACES) {
    const [, family = face, weight = ""] = /^(.*) (\d+)$/.exec(face) ?? [];

    families.set(family, [...(families.get(family) ?? []), weight]);
  }

  return [...families].map(([family, weights]) => `${family} ${weights.join(", ")}`).join("; ");
};

/** The faces as the prompt and the stand-in's error describe them. */
export const FACES_TEXT = facesText();

/**
 * The stand-in for @svjeez/fonts: `google()` and `google.family()` as the package has them, serving the preloaded faces
 * with ligatures off unless a scene asks for them, since text with ligatures embeds the whole face.
 */
const STAND_IN = `import { font } from "/svjeez";
${FACES.map((face, i) => `import f${i} from "/fonts/${i}.ttf";`).join("\n")}
const faces = { ${FACES.map((face, i) => `${JSON.stringify(face)}: f${i}`).join(", ")} };
export const google = Object.assign(
  async (family, options = {}) => {
    const { weight = 400, style = "normal", ligatures = false, ...rest } = options;
    const bytes = style === "normal" ? faces[family + " " + weight] : undefined;
    if (!bytes)
      throw new Error(\`google("\${family}", { weight: \${weight}, style: "\${style}" }) is not available: scenes here have no network, and the preloaded faces are ${FACES_TEXT}, all upright. Use one of them.\`);
    return font(new Uint8Array(bytes), { ...rest, ligatures, family, weight, style });
  },
  {
    family: async (family, faces, options = {}) =>
      font.family(...(await Promise.all(faces.map((face) => google(family, { ...options, ...face }))))),
  },
);
`;

/** Calls the scene's `build()` and answers with its SVG, or what it threw. */
export const MAIN = `import { WorkerEntrypoint } from "cloudflare:workers";
// Library frames come first in a stack; keep enough of it to reach the scene's own line.
Error.stackTraceLimit = 200;
export default class extends WorkerEntrypoint {
  async build() {
    try {
      const scene = await import("./${SCENE}");
      if (typeof scene.default !== "function")
        return { ok: false, message: "The scene has no default export. End it with: export default function build(): string { return render(...); }" };
      const svg = await scene.default();
      if (typeof svg !== "string")
        return { ok: false, message: "build() returned " + typeof svg + ", not the string render() returns." };
      return { ok: true, svg };
    } catch (error) {
      return { ok: false, message: String(error?.message ?? error), stack: String(error?.stack ?? "") };
    }
  }
}`;

const decoded = new Map<string, ArrayBuffer>();

const bytes = (face: string) => {
  let buffer = decoded.get(face);

  if (!buffer) {
    buffer = Uint8Array.from(atob(library.fonts[face]!), (c) => c.charCodeAt(0)).buffer;
    decoded.set(face, buffer);
  }

  return buffer;
};

const parsed = new Map<string, object>();

const json = (specifier: string) => {
  let value = parsed.get(specifier);

  if (!value) {
    // SAFETY: world-atlas's files are TopoJSON objects.
    value = JSON.parse(library.json[specifier]!) as object;
    parsed.set(specifier, value);
  }

  return value;
};

/**
 * The library modules `imports` reach, and no others: a heavy package such as @svjeez/math costs a compile only when
 * the scene imports it. Each specifier in `imports` is in ALLOWED.
 */
export const modulesFor = (imports: readonly string[]) => {
  const modules: Record<string, WorkerLoaderModule> = {};
  const pending = [...imports];

  if (imports.includes(FONTS)) {
    modules[FONTS] = { js: STAND_IN };
    FACES.forEach((face, i) => (modules[`fonts/${i}.ttf`] = { data: bytes(face) }));
    pending.push("svjeez");
  }

  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (name in modules) continue;

    if (name in library.json) {
      modules[name] = { json: json(name) };
      continue;
    }

    modules[name] = { js: library.code[name]! };
    pending.push(...(library.imports[name] ?? []));
  }

  return modules;
};
