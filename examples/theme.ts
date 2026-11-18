import { systemDark, systemLight, type Base16, type Hex } from "svjeez";
import { tokens } from "svjeez/scene";
import { mono } from "./fonts/faces";

const named = (scheme: Base16) => {
  // SAFETY: a base16 scheme is built from hex colors, so each slot is one.
  const hex = (slot: keyof Base16): Hex => scheme[slot] as Hex;

  return {
    background: hex("base00"),
    surface: hex("base01"),
    raised: hex("base02"),
    border: hex("base03"),
    muted: hex("base04"),
    text: hex("base05"),
    red: hex("base08"),
    orange: hex("base09"),
    yellow: hex("base0A"),
    green: hex("base0B"),
    cyan: hex("base0C"),
    blue: hex("base0D"),
    magenta: hex("base0E"),
  };
};

/** The examples' palette as tokens, named for what they are for. Scenes on the scene model take it from here, as the others take `theme` from style.ts. */
export const theme = tokens({ light: named(systemLight), dark: named(systemDark) });

export { mono };
