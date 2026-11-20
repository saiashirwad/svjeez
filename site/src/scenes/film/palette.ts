import { palette } from "@svjeez/code/palettes";

/** Geist's syntax colors: plain text in the foreground, keywords pink, calls purple, numbers blue, strings green. */
export const geistCode = palette("film", {
  light: {
    plain: "#171717",
    comment: "#8F8F8F",
    punctuation: "#8F8F8F",
    keyword: "#C41562",
    string: "#107D32",
    number: "#005FF2",
    constant: "#005FF2",
    variable: "#171717",
    function: "#7D00CC",
    type: "#7D00CC",
    tag: "#C41562",
    inserted: "#107D32",
    deleted: "#C41562",
  },
  dark: {
    plain: "#EDEDED",
    comment: "#8F8F8F",
    punctuation: "#8F8F8F",
    keyword: "#FF4D8D",
    string: "#5AD077",
    number: "#47A8FF",
    constant: "#47A8FF",
    variable: "#EDEDED",
    function: "#C472FB",
    type: "#C472FB",
    tag: "#FF4D8D",
    inserted: "#5AD077",
    deleted: "#FF4D8D",
  },
});
