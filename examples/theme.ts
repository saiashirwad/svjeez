import { tokens } from "svjeez";
import { mono } from "./fonts/faces";

export const theme = tokens({
  light: {
    background: "#FFFFFF",
    surface: "#F5F5F7",
    raised: "#E5E5EA",
    border: "#8E8E93",
    muted: "#6E6E73",
    text: "#1D1D1F",
    red: "#E5453B",
    orange: "#E8751A",
    yellow: "#E5A50A",
    green: "#2FA84F",
    cyan: "#1B9AAA",
    blue: "#0A6CFF",
    magenta: "#9B51E0",
  },
  dark: {
    background: "#090A0C",
    surface: "#18181B",
    raised: "#27272A",
    border: "#7C7C82",
    muted: "#A1A1A6",
    text: "#E5E5EA",
    red: "#FF6961",
    orange: "#FF9F0A",
    yellow: "#FFD60A",
    green: "#32D74B",
    cyan: "#64D2FF",
    blue: "#5EA0FF",
    magenta: "#C58AFF",
  },
});

export { mono };
