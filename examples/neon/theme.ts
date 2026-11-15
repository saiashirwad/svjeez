import type { Color } from "svjeez";
import type { Tally } from "./game";

export const C = {
  bgTop: "#160D33",
  bgBottom: "#07040F",
  magentaGlow: "#FF4FA3",
  cyanGlow: "#36E2D3",
  grid: "#3A2C6B",
  faint: "#4A3F7A",
  text: "#B9AEE0",
  win: "#FFD166",
} as const;

export const TALLY: Record<Tally, { color: Color; label: string; caption: string }> = {
  x: { color: "#FF4FA3", label: "X", caption: "X wins" },
  o: { color: "#36E2D3", label: "O", caption: "O wins" },
  draw: { color: "#A99CFF", label: "Draw", caption: "Draw" },
};
