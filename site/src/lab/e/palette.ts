import type { Hex } from "svjeez";
import type { Fur } from "./genome";

export const INK: Hex = "#2A2320";
export const PAPER = "#F4EFE2";
export const PINK: Hex = "#E98C9A";

export interface Palette {
  readonly base: Hex;
  readonly dark: Hex;
  readonly light: Hex;
  readonly eye: Hex;
}

export const PALETTES: Record<Fur, Palette> = {
  ginger: { base: "#EE9B4F", dark: "#B9612C", light: "#FCE6CC", eye: "#D9E25A" },
  grey: { base: "#A6ABB3", dark: "#5D636C", light: "#E6E8EB", eye: "#9FD7A0" },
  cream: { base: "#F1DDB8", dark: "#C49A5F", light: "#FFF7E8", eye: "#7EC4E8" },
  calico: { base: "#F7F1E7", dark: "#2B2522", light: "#E58B3A", eye: "#E8C548" },
  void: { base: "#1F1B24", dark: "#3B3444", light: "#3B3444", eye: "#F6EB5E" },
  cosmic: { base: "#2E2368", dark: "#5B45BA", light: "#F6E27A", eye: "#FF8FD0" },
};
export const BREAD: Palette = { base: "#D9A15A", dark: "#A8692E", light: "#F6DDB0", eye: "#3B2A1E" };
