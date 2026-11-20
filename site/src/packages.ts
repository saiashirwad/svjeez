import { REPO } from "./links";

export interface Package {
  name: string;
  description: string;
  href: string;
}

const manifests = import.meta.glob<{ name: string; description: string }>(
  "../../packages/*/package.json",
  { eager: true, import: "default" },
);

/** Every package in the workspace, `svjeez` first. */
export const packages: Package[] = Object.entries(manifests)
  .map(([path, { name, description }]) => ({
    name,
    description,
    href: `${REPO}/tree/main/packages/${path.split("/").at(-2)}`,
  }))
  .sort(
    (a, b) =>
      Number(b.name === "svjeez") - Number(a.name === "svjeez") || a.name.localeCompare(b.name),
  );
