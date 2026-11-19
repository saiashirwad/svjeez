import { font, tokens } from "svjeez";

export const theme = tokens({
  light: {
    background: "#F6F7F9",
    surface: "#FFFFFF",
    raised: "#E9ECF1",
    border: "#CDD3DC",
    muted: "#5B6472",
    text: "#161A21",
    blue: "#2F6FEB",
    green: "#17723F",
    red: "#B8322A",
    yellow: "#B7791F",
    magenta: "#B13DB8",
    cyan: "#0F8A9D",
  },
  dark: {
    background: "#0E1116",
    surface: "#171B22",
    raised: "#232934",
    border: "#384152",
    muted: "#9AA4B2",
    text: "#EEF1F5",
    blue: "#6EA2FF",
    green: "#4CC38A",
    red: "#FF7A70",
    yellow: "#F2C14E",
    magenta: "#E07BE0",
    cyan: "#4FD1E0",
  },
});

const face = (file: string) => font.load(new URL(`./fonts/${file}`, import.meta.url));

export const sans = font.family(await face("Geist-400.ttf"), await face("Geist-600.ttf"));
