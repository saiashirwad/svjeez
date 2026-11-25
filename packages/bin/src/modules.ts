// Every module a scene can import from the binary, by specifier. Each loads the first time a scene imports it, so a
// command pays only for the packages its scene uses. test/modules.test.ts checks this against the packages' exports.

export const PACKAGES = [
  "svjeez",
  "charts",
  "code",
  "diagrams",
  "fonts",
  "geo",
  "icons",
  "math",
  "mermaid",
  "video",
] as const;

export const MODULES = new Map<string, () => Promise<object>>([
  ["svjeez", () => import("svjeez")],
  ["svjeez/jsx-runtime", () => import("svjeez/jsx-runtime")],
  ["svjeez/jsx-dev-runtime", () => import("svjeez/jsx-dev-runtime")],
  ["svjeez/tools", () => import("svjeez/tools")],
  ["svjeez/typecheck", () => import("svjeez/typecheck")],
  ["svjeez/frames", () => import("svjeez/frames")],
  ["svjeez/page", () => import("svjeez/page")],
  ["@svjeez/charts", () => import("@svjeez/charts")],
  ["@svjeez/code", () => import("@svjeez/code")],
  ["@svjeez/code/palettes", () => import("@svjeez/code/palettes")],
  ["@svjeez/diagrams", () => import("@svjeez/diagrams")],
  ["@svjeez/fonts", () => import("@svjeez/fonts")],
  ["@svjeez/fonts/handwriting", () => import("@svjeez/fonts/handwriting")],
  ["@svjeez/geo", () => import("@svjeez/geo")],
  ["@svjeez/icons", () => import("@svjeez/icons")],
  ["@svjeez/icons/tabler", () => import("@svjeez/icons/tabler")],
  ["@svjeez/icons/lucide", () => import("@svjeez/icons/lucide")],
  ["@svjeez/math", () => import("@svjeez/math")],
  ["@svjeez/mermaid", () => import("@svjeez/mermaid")],
  ["@svjeez/video", () => import("@svjeez/video")],
]);
